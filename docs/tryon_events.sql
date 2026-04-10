-- Migration: tryon_events
-- Registra cada chamada de try-on por org, produto e usuário.
-- Uso: rastrear custo, impor caps mensais e cachear resultados.

CREATE TABLE IF NOT EXISTS tryon_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  product_id       UUID        REFERENCES products(id) ON DELETE SET NULL,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  fal_request_id   TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result_image_url TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tryon_events_org_id         ON tryon_events (org_id);
CREATE INDEX IF NOT EXISTS idx_tryon_events_fal_request_id ON tryon_events (fal_request_id);
CREATE INDEX IF NOT EXISTS idx_tryon_events_created_at     ON tryon_events (org_id, created_at DESC);

ALTER TABLE tryon_events ENABLE ROW LEVEL SECURITY;

-- Membros da org podem ler os eventos da sua org
DROP POLICY IF EXISTS "tryon_events_org_member_select" ON tryon_events;
CREATE POLICY "tryon_events_org_member_select" ON tryon_events
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Apenas server-side (service_role) pode inserir/atualizar
-- (as routes de API usam o cliente server com RLS bypassado pelo service_role)

-- Adicionar coluna tryon_calls ao org_usage_daily se não existir
ALTER TABLE org_usage_daily ADD COLUMN IF NOT EXISTS tryon_calls BIGINT NOT NULL DEFAULT 0;

-- Provisionar plano freemium para os 2 lojistas de validação:
-- UPDATE orgs
--   SET plan_id = 'freemium',
--       limits  = limits || '{"tryon_monthly": 9999}'::jsonb
-- WHERE slug IN ('loja-feminina', 'loja-masculina');
