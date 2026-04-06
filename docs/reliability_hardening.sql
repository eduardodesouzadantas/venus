ALTER TABLE saved_results
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_results_idempotency_key
  ON saved_results (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION tenant.lead_status_rank(p_status TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE LOWER(NULLIF(BTRIM(COALESCE(p_status, '')), ''))
    WHEN 'new' THEN 0
    WHEN 'engaged' THEN 1
    WHEN 'qualified' THEN 2
    WHEN 'offer_sent' THEN 3
    WHEN 'closing' THEN 4
    WHEN 'won' THEN 5
    WHEN 'lost' THEN 6
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION tenant.resolve_lead_status(existing_status TEXT, next_status TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  WITH normalized AS (
    SELECT
      NULLIF(BTRIM(COALESCE(existing_status, '')), '') AS current_status,
      NULLIF(BTRIM(COALESCE(next_status, '')), '') AS desired_status
  )
  SELECT CASE
    WHEN desired_status IS NULL THEN COALESCE(current_status, 'new')
    WHEN current_status IS NULL THEN desired_status
    WHEN current_status IN ('won', 'lost') AND current_status <> desired_status THEN current_status
    WHEN current_status IN ('won', 'lost') AND desired_status IN ('won', 'lost') THEN current_status
    WHEN tenant.lead_status_rank(desired_status) >= tenant.lead_status_rank(current_status) THEN desired_status
    ELSE current_status
  END
  FROM normalized;
$$;

CREATE OR REPLACE FUNCTION tenant.apply_lead_state_change(
  p_org_id UUID,
  p_lead_id UUID,
  p_has_status BOOLEAN DEFAULT FALSE,
  p_status TEXT DEFAULT NULL,
  p_has_next_follow_up_at BOOLEAN DEFAULT FALSE,
  p_next_follow_up_at TIMESTAMPTZ DEFAULT NULL,
  p_last_interaction_at TIMESTAMPTZ DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL,
  p_event_source TEXT DEFAULT 'agency',
  p_idempotency_key TEXT DEFAULT NULL,
  p_expected_updated_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF leads
LANGUAGE plpgsql
AS $$
DECLARE
  v_idempotency_key TEXT;
  v_existing_lead leads%ROWTYPE;
  v_updated_lead leads%ROWTYPE;
  v_org_slug TEXT;
  v_event_type TEXT;
  v_event_id UUID;
  v_next_status TEXT;
  v_has_status_change BOOLEAN;
BEGIN
  IF p_org_id IS NULL OR p_lead_id IS NULL THEN
    RAISE EXCEPTION 'Missing lead identifiers';
  END IF;

  IF NOT p_has_status AND NOT p_has_next_follow_up_at THEN
    RAISE EXCEPTION 'Missing lead updates';
  END IF;

  v_idempotency_key := COALESCE(
    NULLIF(BTRIM(p_idempotency_key), ''),
    format(
      'lead-state:%s:%s:%s:%s:%s',
      p_org_id::text,
      p_lead_id::text,
      CASE WHEN p_has_status THEN COALESCE(BTRIM(COALESCE(p_status, '')), 'noop') ELSE 'noop' END,
      CASE WHEN p_has_next_follow_up_at THEN COALESCE(p_next_follow_up_at::text, 'null') ELSE 'noop' END,
      COALESCE(p_expected_updated_at::text, 'null')
    )
  );

  PERFORM pg_advisory_xact_lock(hashtext(v_idempotency_key));

  SELECT *
  INTO v_existing_lead
  FROM leads
  WHERE org_id = p_org_id
    AND id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;

  IF p_expected_updated_at IS NOT NULL AND v_existing_lead.updated_at IS NOT NULL AND v_existing_lead.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'Lead changed while editing' USING ERRCODE = '40001';
  END IF;

  SELECT slug
  INTO v_org_slug
  FROM orgs
  WHERE id = p_org_id;

  SELECT id
  INTO v_event_id
  FROM tenant_events
  WHERE dedupe_key = v_idempotency_key
  LIMIT 1;

  IF v_event_id IS NOT NULL THEN
    RETURN NEXT v_existing_lead;
    RETURN;
  END IF;

  v_next_status := CASE
    WHEN p_has_status THEN tenant.resolve_lead_status(v_existing_lead.status, p_status)
    ELSE v_existing_lead.status
  END;
  v_has_status_change := p_has_status AND v_next_status IS DISTINCT FROM v_existing_lead.status;

  UPDATE leads
  SET
    name = v_existing_lead.name,
    email = v_existing_lead.email,
    phone = v_existing_lead.phone,
    source = v_existing_lead.source,
    status = v_next_status,
    saved_result_id = v_existing_lead.saved_result_id,
    intent_score = v_existing_lead.intent_score,
    whatsapp_key = v_existing_lead.whatsapp_key,
    next_follow_up_at = CASE
      WHEN p_has_next_follow_up_at THEN p_next_follow_up_at
      ELSE v_existing_lead.next_follow_up_at
    END,
    updated_at = COALESCE(p_last_interaction_at, NOW()),
    last_interaction_at = COALESCE(p_last_interaction_at, NOW())
  WHERE org_id = p_org_id
    AND id = p_lead_id
  RETURNING * INTO v_updated_lead;

  v_event_type := CASE
    WHEN v_has_status_change AND v_next_status = 'offer_sent' THEN 'lead.offer_sent'
    WHEN v_has_status_change AND v_next_status = 'closing' THEN 'lead.closing_started'
    WHEN v_has_status_change AND v_next_status = 'won' THEN 'lead.closed_won'
    WHEN v_has_status_change AND v_next_status = 'lost' THEN 'lead.closed_lost'
    WHEN v_has_status_change THEN 'lead.status_updated'
    WHEN p_has_next_follow_up_at THEN 'lead.follow_up_updated'
    ELSE 'lead.status_updated'
  END;

  INSERT INTO tenant_events (
    org_id,
    actor_user_id,
    event_type,
    event_source,
    dedupe_key,
    payload
  )
  VALUES (
    p_org_id,
    p_actor_user_id,
    v_event_type,
    p_event_source,
    v_idempotency_key,
    jsonb_build_object(
      'lead_id', v_updated_lead.id,
      'org_id', p_org_id,
      'org_slug', v_org_slug,
      'previous_status', v_existing_lead.status,
      'next_status', v_updated_lead.status,
      'previous_follow_up_at', v_existing_lead.next_follow_up_at,
      'next_follow_up_at', v_updated_lead.next_follow_up_at,
      'lead_name', v_existing_lead.name,
      'lead_email', v_existing_lead.email,
      'lead_phone', v_existing_lead.phone,
      'lead_source', v_existing_lead.source,
      'updated_fields', jsonb_build_object(
        'status', v_has_status_change,
        'next_follow_up_at', p_has_next_follow_up_at
      )
    )
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEXT v_updated_lead;
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION tenant.persist_saved_result_and_lead(
  p_org_id UUID,
  p_idempotency_key TEXT,
  p_user_email TEXT DEFAULT NULL,
  p_user_name TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_lead_name TEXT DEFAULT NULL,
  p_lead_email TEXT DEFAULT NULL,
  p_lead_phone TEXT DEFAULT NULL,
  p_lead_source TEXT DEFAULT 'app',
  p_lead_status TEXT DEFAULT 'new',
  p_intent_score NUMERIC DEFAULT NULL,
  p_whatsapp_key TEXT DEFAULT NULL,
  p_last_interaction_at TIMESTAMPTZ DEFAULT NULL,
  p_event_source TEXT DEFAULT 'app'
)
RETURNS TABLE (
  saved_result_id UUID,
  lead_id UUID,
  saved_result_created BOOLEAN,
  lead_created BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_idempotency_key TEXT;
  v_saved_result_id UUID;
  v_saved_result_exists BOOLEAN;
  v_existing_lead leads%ROWTYPE;
  v_existing_lead_id UUID;
  v_created_lead BOOLEAN := FALSE;
  v_lead_source TEXT;
  v_lead_status TEXT;
  v_normalized_email TEXT;
  v_normalized_phone TEXT;
  v_effective_name TEXT;
  v_effective_follow_up TIMESTAMPTZ;
  v_org_slug TEXT;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Missing org id';
  END IF;

  v_idempotency_key := NULLIF(BTRIM(p_idempotency_key), '');
  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Missing saved result idempotency key';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_idempotency_key));

  SELECT id
  INTO v_saved_result_id
  FROM saved_results
  WHERE idempotency_key = v_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    SELECT slug
    INTO v_org_slug
    FROM orgs
    WHERE id = p_org_id;

    SELECT id
    INTO v_existing_lead_id
    FROM leads
    WHERE org_id = p_org_id
      AND saved_result_id = v_saved_result_id
    LIMIT 1;

    RETURN QUERY
    SELECT v_saved_result_id, v_existing_lead_id, FALSE, FALSE;
    RETURN;
  END IF;

  INSERT INTO saved_results (
    org_id,
    user_email,
    user_name,
    payload,
    idempotency_key
  )
  VALUES (
    p_org_id,
    NULLIF(BTRIM(COALESCE(p_user_email, '')), ''),
    NULLIF(BTRIM(COALESCE(p_user_name, '')), ''),
    COALESCE(p_payload, '{}'::jsonb),
    v_idempotency_key
  )
  RETURNING id INTO v_saved_result_id;

  v_normalized_email := NULLIF(LOWER(BTRIM(COALESCE(p_lead_email, ''))), '');
  v_normalized_phone := NULLIF(REGEXP_REPLACE(COALESCE(p_lead_phone, ''), '\\D', '', 'g'), '');
  v_effective_name := NULLIF(BTRIM(COALESCE(p_lead_name, '')), '');
  v_lead_source := COALESCE(NULLIF(BTRIM(COALESCE(p_lead_source, '')), ''), 'app');
  v_lead_status := COALESCE(NULLIF(BTRIM(COALESCE(p_lead_status, '')), ''), 'new');
  v_effective_follow_up := COALESCE(p_last_interaction_at, NOW());

  SELECT *
  INTO v_existing_lead
  FROM leads
  WHERE org_id = p_org_id
    AND (
      saved_result_id = v_saved_result_id
      OR (v_normalized_phone IS NOT NULL AND phone = v_normalized_phone)
      OR (v_normalized_email IS NOT NULL AND email = v_normalized_email)
    )
  ORDER BY
    CASE
      WHEN saved_result_id = v_saved_result_id THEN 0
      WHEN v_normalized_phone IS NOT NULL AND phone = v_normalized_phone THEN 1
      ELSE 2
    END
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE leads
    SET
      name = COALESCE(v_effective_name, v_existing_lead.name),
      email = COALESCE(v_normalized_email, v_existing_lead.email),
      phone = COALESCE(v_normalized_phone, v_existing_lead.phone),
      source = COALESCE(NULLIF(BTRIM(COALESCE(v_lead_source, '')), ''), v_existing_lead.source),
      status = tenant.resolve_lead_status(v_existing_lead.status, v_lead_status),
      saved_result_id = v_saved_result_id,
      intent_score = CASE
        WHEN p_intent_score IS NULL THEN v_existing_lead.intent_score
        WHEN v_existing_lead.intent_score IS NULL THEN p_intent_score
        ELSE GREATEST(v_existing_lead.intent_score, p_intent_score)
      END,
      whatsapp_key = COALESCE(NULLIF(BTRIM(COALESCE(p_whatsapp_key, '')), ''), v_normalized_phone, v_existing_lead.whatsapp_key),
      last_interaction_at = v_effective_follow_up,
      updated_at = v_effective_follow_up
    WHERE id = v_existing_lead.id
      AND org_id = p_org_id
    RETURNING * INTO v_existing_lead;
  ELSE
    INSERT INTO leads (
      org_id,
      name,
      email,
      phone,
      source,
      status,
      saved_result_id,
      intent_score,
      whatsapp_key,
      updated_at,
      last_interaction_at
    )
    VALUES (
      p_org_id,
      v_effective_name,
      v_normalized_email,
      v_normalized_phone,
      v_lead_source,
      v_lead_status,
      v_saved_result_id,
      p_intent_score,
      COALESCE(NULLIF(BTRIM(COALESCE(p_whatsapp_key, '')), ''), v_normalized_phone),
      v_effective_follow_up,
      v_effective_follow_up
    )
    RETURNING * INTO v_existing_lead;

    v_created_lead := TRUE;
  END IF;

  SELECT slug
  INTO v_org_slug
  FROM orgs
  WHERE id = p_org_id;

  INSERT INTO tenant_events (
    org_id,
    actor_user_id,
    event_type,
    event_source,
    dedupe_key,
    payload
  )
  VALUES (
    p_org_id,
    NULL,
    'app.saved_result_created',
    p_event_source,
    format('saved_result_created:%s:%s', p_org_id::text, v_saved_result_id::text),
    jsonb_build_object(
      'saved_result_id', v_saved_result_id,
      'org_slug', v_org_slug
    )
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  INSERT INTO tenant_events (
    org_id,
    actor_user_id,
    event_type,
    event_source,
    dedupe_key,
    payload
  )
  VALUES (
    p_org_id,
    NULL,
    CASE WHEN v_created_lead THEN 'lead.created_from_app' ELSE 'lead.updated_from_app' END,
    p_event_source,
    format('lead_from_app:%s:%s:%s', p_org_id::text, v_existing_lead.id::text, v_saved_result_id::text),
    jsonb_build_object(
      'lead_id', v_existing_lead.id,
      'saved_result_id', v_saved_result_id,
      'org_slug', v_org_slug,
      'created', v_created_lead
    )
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  INSERT INTO org_usage_daily (
    org_id,
    usage_date,
    events_count,
    leads,
    updated_at
  )
  VALUES (
    p_org_id,
    CURRENT_DATE,
    1,
    CASE WHEN v_created_lead THEN 1 ELSE 0 END,
    NOW()
  )
  ON CONFLICT (org_id, usage_date)
  DO UPDATE SET
    events_count = org_usage_daily.events_count + EXCLUDED.events_count,
    leads = org_usage_daily.leads + EXCLUDED.leads,
    updated_at = NOW();

  RETURN QUERY
  SELECT v_saved_result_id, v_existing_lead.id, TRUE, v_created_lead;
END;
$$;
