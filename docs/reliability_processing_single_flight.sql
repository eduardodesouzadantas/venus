CREATE TABLE IF NOT EXISTS tenant_processing_reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  reservation_key TEXT NOT NULL UNIQUE,
  owner_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  saved_result_id UUID REFERENCES saved_results(id) ON DELETE SET NULL,
  error_message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_processing_reservations_org_id ON tenant_processing_reservations (org_id);
CREATE INDEX IF NOT EXISTS idx_tenant_processing_reservations_status ON tenant_processing_reservations (status);
CREATE INDEX IF NOT EXISTS idx_tenant_processing_reservations_expires_at ON tenant_processing_reservations (expires_at);

ALTER TABLE tenant_processing_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_processing_reservations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency can manage processing reservations" ON tenant_processing_reservations;
CREATE POLICY "Agency can manage processing reservations"
  ON tenant_processing_reservations
  FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_processing_reservations TO authenticated;

CREATE OR REPLACE FUNCTION tenant.reserve_saved_result_processing(
  p_org_id UUID,
  p_reservation_key TEXT,
  p_owner_token TEXT,
  p_ttl_seconds INTEGER DEFAULT 900
)
RETURNS TABLE (
  reservation_key TEXT,
  status TEXT,
  saved_result_id UUID,
  owner_token TEXT,
  expires_at TIMESTAMPTZ,
  acquired BOOLEAN,
  should_wait BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_reservation_key TEXT;
  v_owner_token TEXT;
  v_ttl_seconds INTEGER;
  v_now TIMESTAMPTZ := NOW();
  v_reservation tenant_processing_reservations%ROWTYPE;
  v_completed_saved_result_id UUID;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Missing org id';
  END IF;

  v_reservation_key := NULLIF(BTRIM(p_reservation_key), '');
  v_owner_token := NULLIF(BTRIM(p_owner_token), '');

  IF v_reservation_key IS NULL OR v_owner_token IS NULL THEN
    RAISE EXCEPTION 'Missing processing reservation identifiers';
  END IF;

  v_ttl_seconds := GREATEST(300, LEAST(COALESCE(p_ttl_seconds, 900), 3600));

  PERFORM pg_advisory_xact_lock(hashtext(v_reservation_key));

  SELECT sr.id
  INTO v_completed_saved_result_id
  FROM saved_results sr
  WHERE sr.org_id = p_org_id
    AND sr.idempotency_key = v_reservation_key
  LIMIT 1;

  IF FOUND AND v_completed_saved_result_id IS NOT NULL THEN
    INSERT INTO tenant_processing_reservations (
      org_id,
      reservation_key,
      owner_token,
      status,
      saved_result_id,
      expires_at,
      updated_at,
      last_claimed_at
    )
    VALUES (
      p_org_id,
      v_reservation_key,
      v_owner_token,
      'completed',
      v_completed_saved_result_id,
      v_now + INTERVAL '1 day',
      v_now,
      v_now
    )
    ON CONFLICT (reservation_key)
    DO UPDATE SET
      org_id = EXCLUDED.org_id,
      owner_token = EXCLUDED.owner_token,
      status = 'completed',
      saved_result_id = EXCLUDED.saved_result_id,
      error_message = NULL,
      expires_at = EXCLUDED.expires_at,
      updated_at = EXCLUDED.updated_at,
      last_claimed_at = EXCLUDED.last_claimed_at;

    RETURN QUERY
    SELECT v_reservation_key, 'completed', v_completed_saved_result_id, v_owner_token, v_now + INTERVAL '1 day', FALSE, FALSE, NULL::TEXT;
    RETURN;
  END IF;

  SELECT *
  INTO v_reservation
  FROM tenant_processing_reservations tp
  WHERE tp.reservation_key = v_reservation_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_reservation.status = 'completed' AND v_reservation.saved_result_id IS NOT NULL THEN
      RETURN QUERY
      SELECT v_reservation.reservation_key, v_reservation.status, v_reservation.saved_result_id, v_reservation.owner_token, v_reservation.expires_at, FALSE, FALSE, v_reservation.error_message;
      RETURN;
    END IF;

    IF v_reservation.status = 'in_progress' AND v_reservation.expires_at > v_now AND v_reservation.owner_token <> v_owner_token THEN
      RETURN QUERY
      SELECT v_reservation.reservation_key, v_reservation.status, v_reservation.saved_result_id, v_reservation.owner_token, v_reservation.expires_at, FALSE, TRUE, v_reservation.error_message;
      RETURN;
    END IF;

    IF v_reservation.status = 'in_progress' AND v_reservation.owner_token = v_owner_token THEN
    UPDATE tenant_processing_reservations
    SET
      expires_at = v_now + (INTERVAL '1 second' * v_ttl_seconds),
      updated_at = v_now,
      last_claimed_at = v_now
    WHERE tenant_processing_reservations.reservation_key = v_reservation_key
    RETURNING * INTO v_reservation;

      RETURN QUERY
      SELECT v_reservation.reservation_key, v_reservation.status, v_reservation.saved_result_id, v_reservation.owner_token, v_reservation.expires_at, TRUE, FALSE, v_reservation.error_message;
      RETURN;
    END IF;

    UPDATE tenant_processing_reservations
    SET
      org_id = p_org_id,
      owner_token = v_owner_token,
    status = 'in_progress',
      saved_result_id = NULL,
      error_message = NULL,
      expires_at = v_now + (INTERVAL '1 second' * v_ttl_seconds),
      updated_at = v_now,
      last_claimed_at = v_now
    WHERE reservation_key = v_reservation_key
    RETURNING * INTO v_reservation;

    RETURN QUERY
    SELECT v_reservation.reservation_key, v_reservation.status, v_reservation.saved_result_id, v_reservation.owner_token, v_reservation.expires_at, TRUE, FALSE, v_reservation.error_message;
    RETURN;
  END IF;

  INSERT INTO tenant_processing_reservations (
    org_id,
    reservation_key,
    owner_token,
    status,
    saved_result_id,
    expires_at,
    updated_at,
    last_claimed_at
  )
  VALUES (
    p_org_id,
    v_reservation_key,
    v_owner_token,
    'in_progress',
    NULL,
    v_now + (INTERVAL '1 second' * v_ttl_seconds),
    v_now,
    v_now
  )
  RETURNING * INTO v_reservation;

  RETURN QUERY
  SELECT v_reservation.reservation_key, v_reservation.status, v_reservation.saved_result_id, v_reservation.owner_token, v_reservation.expires_at, TRUE, FALSE, v_reservation.error_message;
END;
$$;

CREATE OR REPLACE FUNCTION tenant.complete_saved_result_processing(
  p_org_id UUID,
  p_reservation_key TEXT,
  p_owner_token TEXT,
  p_saved_result_id UUID
)
RETURNS TABLE (
  reservation_key TEXT,
  status TEXT,
  saved_result_id UUID,
  owner_token TEXT,
  expires_at TIMESTAMPTZ,
  completed BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_reservation tenant_processing_reservations%ROWTYPE;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Missing org id';
  END IF;

  IF NULLIF(BTRIM(p_reservation_key), '') IS NULL OR NULLIF(BTRIM(p_owner_token), '') IS NULL OR p_saved_result_id IS NULL THEN
    RAISE EXCEPTION 'Missing processing completion identifiers';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(BTRIM(p_reservation_key)));

  SELECT *
  INTO v_reservation
  FROM tenant_processing_reservations tp
  WHERE tp.org_id = p_org_id
    AND tp.reservation_key = BTRIM(p_reservation_key)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processing reservation not found';
  END IF;

  IF v_reservation.status = 'completed' AND v_reservation.saved_result_id = p_saved_result_id THEN
    RETURN QUERY
    SELECT v_reservation.reservation_key, v_reservation.status, v_reservation.saved_result_id, v_reservation.owner_token, v_reservation.expires_at, TRUE, v_reservation.error_message;
    RETURN;
  END IF;

  IF v_reservation.owner_token <> BTRIM(p_owner_token) AND v_reservation.expires_at > v_now THEN
    RAISE EXCEPTION 'Processing reservation owner mismatch' USING ERRCODE = '40001';
  END IF;

  UPDATE tenant_processing_reservations
  SET
    status = 'completed',
    saved_result_id = p_saved_result_id,
    error_message = NULL,
    expires_at = v_now + INTERVAL '1 day',
    updated_at = v_now,
    last_claimed_at = v_now
  WHERE org_id = p_org_id
    AND tenant_processing_reservations.reservation_key = BTRIM(p_reservation_key)
  RETURNING * INTO v_reservation;

  RETURN QUERY
  SELECT v_reservation.reservation_key, v_reservation.status, v_reservation.saved_result_id, v_reservation.owner_token, v_reservation.expires_at, TRUE, v_reservation.error_message;
END;
$$;

CREATE OR REPLACE FUNCTION tenant.fail_saved_result_processing(
  p_org_id UUID,
  p_reservation_key TEXT,
  p_owner_token TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS TABLE (
  reservation_key TEXT,
  status TEXT,
  saved_result_id UUID,
  owner_token TEXT,
  expires_at TIMESTAMPTZ,
  failed BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_reservation tenant_processing_reservations%ROWTYPE;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Missing org id';
  END IF;

  IF NULLIF(BTRIM(p_reservation_key), '') IS NULL OR NULLIF(BTRIM(p_owner_token), '') IS NULL THEN
    RAISE EXCEPTION 'Missing processing failure identifiers';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(BTRIM(p_reservation_key)));

  SELECT *
  INTO v_reservation
  FROM tenant_processing_reservations tp
  WHERE tp.org_id = p_org_id
    AND tp.reservation_key = BTRIM(p_reservation_key)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processing reservation not found';
  END IF;

  IF v_reservation.status = 'completed' THEN
    RETURN QUERY
    SELECT v_reservation.reservation_key, v_reservation.status, v_reservation.saved_result_id, v_reservation.owner_token, v_reservation.expires_at, FALSE, v_reservation.error_message;
    RETURN;
  END IF;

  IF v_reservation.owner_token <> BTRIM(p_owner_token) AND v_reservation.expires_at > v_now THEN
    RAISE EXCEPTION 'Processing reservation owner mismatch' USING ERRCODE = '40001';
  END IF;

  UPDATE tenant_processing_reservations
  SET
    status = 'failed',
    error_message = NULLIF(BTRIM(COALESCE(p_error_message, '')), ''),
    updated_at = v_now,
    expires_at = v_now
  WHERE org_id = p_org_id
    AND tenant_processing_reservations.reservation_key = BTRIM(p_reservation_key)
  RETURNING * INTO v_reservation;

  RETURN QUERY
  SELECT v_reservation.reservation_key, v_reservation.status, v_reservation.saved_result_id, v_reservation.owner_token, v_reservation.expires_at, TRUE, v_reservation.error_message;
END;
$$;
