-- Profit & Cost Control Engine for Venus Engine

-- Model of costs per resource type
CREATE TABLE IF NOT EXISTS billing_resource_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_type TEXT NOT NULL UNIQUE,
  unit_cost_cents BIGINT NOT NULL DEFAULT 0,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default costs
INSERT INTO billing_resource_costs (resource_type, unit_cost_cents) VALUES
  ('ai_tokens', 1),          -- 1 cent per token (scaled)
  ('ai_requests', 150),       -- R$ 1.50 per request
  ('try_on', 250),            -- R$ 2.50 per try-on
  ('whatsapp_message', 2),     -- R$ 0.02 per message
  ('whatsapp_conversation', 50), -- R$ 0.50 per conversation
  ('saved_result', 150),     -- R$ 1.50 per result
  ('product_create', 20),    -- R$ 0.20 per product
  ('lead_create', 8),         -- R$ 0.08 per lead
  ('email_sent', 1),          -- R$ 0.01 per email
  ('sms_sent', 5)             -- R$ 0.05 per SMS
ON CONFLICT (resource_type) DO NOTHING;

-- Revenue sources configuration
CREATE TABLE IF NOT EXISTS billing_revenue_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_sources_org_id ON billing_revenue_sources (org_id);
CREATE INDEX IF NOT EXISTS idx_revenue_sources_period ON billing_revenue_sources (period_start, period_end DESC);

-- Cost & profit summary per org (cached)
CREATE TABLE IF NOT EXISTS billing_profit_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  period DATE NOT NULL,
  revenue_cents BIGINT NOT NULL DEFAULT 0,
  confirmed_revenue_cents BIGINT NOT NULL DEFAULT 0,
  cost_cents BIGINT NOT NULL DEFAULT 0,
  margin_cents BIGINT NOT NULL DEFAULT 0,
  margin_percent NUMERIC,
  forecast_end_of_month_cents BIGINT,
  daily_average_cents BIGINT,
  alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, period)
);

CREATE INDEX IF NOT EXISTS idx_profit_summary_org_id ON billing_profit_summary (org_id);
CREATE INDEX IF NOT EXISTS idx_profit_summary_period ON billing_profit_summary (period DESC);

-- RLS
ALTER TABLE billing_resource_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_revenue_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_profit_summary ENABLE ROW LEVEL SECURITY;

ALTER TABLE billing_resource_costs FORCE ROW LEVEL SECURITY;
ALTER TABLE billing_revenue_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE billing_profit_summary FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency manages resource costs" ON billing_resource_costs;
CREATE POLICY "Agency manages resource costs"
  ON billing_resource_costs FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

DROP POLICY IF EXISTS "Agency manages revenue sources" ON billing_revenue_sources;
CREATE POLICY "Agency manages revenue sources"
  ON billing_revenue_sources FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

DROP POLICY IF EXISTS "Agency manages profit summary" ON billing_profit_summary;
CREATE POLICY "Agency manages profit summary"
  ON billing_profit_summary FOR ALL
  USING (tenant.is_agency_user())
  WITH CHECK (tenant.is_agency_user());

GRANT SELECT, INSERT, UPDATE ON billing_resource_costs TO authenticated;
GRANT SELECT, INSERT ON billing_revenue_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE ON billing_profit_summary TO authenticated;

-- Function: calculate tenant cost
CREATE OR REPLACE FUNCTION public.calculate_tenant_cost(
  p_org_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total_cost BIGINT := 0;
  v_recording RECORD;
BEGIN
  FOR v_recording IN
    SELECT 
      ru.resource_type,
      SUM(ru.used_count) as total_used,
      brc.unit_cost_cents
    FROM org_resource_usage ru
    LEFT JOIN billing_resource_costs brc ON brc.resource_type = ru.resource_type
    WHERE ru.org_id = p_org_id
      AND ru.usage_period BETWEEN p_period_start AND p_period_end
    GROUP BY ru.resource_type, brc.unit_cost_cents
  LOOP
    v_total_cost := v_total_cost + (v_recording.total_used * v_recording.unit_cost_cents);
  END LOOP;
  
  RETURN v_total_cost;
END;
$$;

-- Function: calculate tenant profit
CREATE OR REPLACE FUNCTION public.calculate_tenant_profit(
  p_org_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSONB;
  v_revenue BIGINT;
  v_confirmed_revenue BIGINT;
  v_cost BIGINT;
  v_margin BIGINT;
  v_margin_percent NUMERIC;
BEGIN
  -- Get revenue from org_usage_daily
  SELECT COALESCE(SUM(revenue_cents), 0), COALESCE(SUM(cost_cents), 0)
  INTO v_revenue, v_cost
  FROM org_usage_daily
  WHERE org_id = p_org_id AND usage_period BETWEEN p_period_start AND p_period_end;
  
  -- Get confirmed revenue from billing_revenue_sources
  SELECT COALESCE(SUM(amount_cents), 0)
  INTO v_confirmed_revenue
  FROM billing_revenue_sources
  WHERE org_id = p_org_id
    AND period_start >= p_period_start
    AND period_end <= p_period_end
    AND is_confirmed = TRUE;
  
  -- Use confirmed if available, otherwise use estimated
  IF v_confirmed_revenue > 0 THEN
    v_revenue := v_confirmed_revenue;
  END IF;
  
  v_margin := v_revenue - v_cost;
  
  IF v_revenue > 0 THEN
    v_margin_percent := ROUND((v_margin::NUMERIC / v_revenue::NUMERIC) * 100, 2);
  ELSE
    v_margin_percent := 0;
  END IF;
  
  v_result := jsonb_build_object(
    'revenue_cents', v_revenue,
    'confirmed_revenue_cents', v_confirmed_revenue,
    'cost_cents', v_cost,
    'margin_cents', v_margin,
    'margin_percent', v_margin_percent,
    'period_start', p_period_start,
    'period_end', p_period_end
  );
  
  RETURN v_result;
END;
$$;

-- Function: forecast tenant spending
CREATE OR REPLACE FUNCTION public.calculate_tenant_forecast(
  p_org_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSONB;
  v_current_cost BIGINT;
  v_days_elapsed INTEGER;
  v_days_total INTEGER;
  v_daily_average BIGINT;
  v_forecast BIGINT;
BEGIN
  -- Get current period cost
  SELECT COALESCE(SUM(cost_cents), 0)
  INTO v_current_cost
  FROM org_usage_daily
  WHERE org_id = p_org_id AND usage_period BETWEEN p_period_start AND p_period_end;
  
  v_days_elapsed := CURRENT_DATE - p_period_start + 1;
  v_days_total := p_period_end - p_period_start + 1;
  
  IF v_days_elapsed > 0 THEN
    v_daily_average := v_current_cost / v_days_elapsed;
  ELSE
    v_daily_average := 0;
  END IF;
  
  v_forecast := v_daily_average * v_days_total;
  
  v_result := jsonb_build_object(
    'current_cost_cents', v_current_cost,
    'daily_average_cents', v_daily_average,
    'forecast_cost_cents', v_forecast,
    'days_elapsed', v_days_elapsed,
    'days_total', v_days_total,
    'period_start', p_period_start,
    'period_end', p_period_end
  );
  
  RETURN v_result;
END;
$$;

-- Function: generate profit alerts
CREATE OR REPLACE FUNCTION public.generate_profit_alerts(
  p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_alerts JSONB := '[]'::jsonb;
  v_profit JSONB;
  v_forecast JSONB;
  v_period_start DATE;
  v_period_end DATE;
  v_margin_percent NUMERIC;
  v_forecast_cost BIGINT;
  v_budget BIGINT;
BEGIN
  v_period_start := DATE_TRUNC('month', CURRENT_DATE);
  v_period_end := v_period_start + INTERVAL '1 month' - INTERVAL '1 day';
  
  -- Get profit data
  v_profit := calculate_tenant_profit(p_org_id, v_period_start, v_period_end);
  v_margin_percent := (v_profit->>'margin_percent')::NUMERIC;
  
  -- Get forecast
  v_forecast := calculate_tenant_forecast(p_org_id, v_period_start, v_period_end);
  v_forecast_cost := (v_forecast->>'forecast_cost_cents')::BIGINT;
  
  -- Get budget from plan
  SELECT limits->>'monthly_budget'::BIGINT
  INTO v_budget
  FROM orgs WHERE id = p_org_id;
  
  -- Generate alerts
  IF v_margin_percent < 0 THEN
    v_alerts := v_alerts || jsonb_build_array(jsonb_build_object('type', 'negative_margin', 'severity', 'critical', 'message', 'Margem negativa: ' || v_margin_percent || '%'));
  ELSIF v_margin_percent < 20 THEN
    v_alerts := v_alerts || jsonb_build_array(jsonb_build_object('type', 'low_margin', 'severity', 'warning', 'message', 'Margem baixa: ' || v_margin_percent || '%'));
  END IF;
  
  IF v_forecast_cost > v_budget AND v_budget > 0 THEN
    v_alerts := v_alerts || jsonb_build_array(jsonb_build_object('type', 'budget_exceeded', 'severity', 'critical', 'message', 'Previsão de custo excede orçamento'));
  END IF;
  
  RETURN v_alerts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_tenant_cost(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_tenant_profit(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_tenant_forecast(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_profit_alerts(UUID) TO authenticated;