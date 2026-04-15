-- Migration: Look Compositions Tables
-- Cria tabelas para salvar looks compostos e seus try-ons

-- Tabela: look_compositions
CREATE TABLE IF NOT EXISTS look_compositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  result_id UUID REFERENCES saved_results(id),
  lead_id UUID,
  
  -- Informações do look
  name VARCHAR(255) NOT NULL,
  description TEXT,
  anchor_piece_id UUID NOT NULL,
  support_piece_ids UUID[] DEFAULT '{}',
  accessory_ids UUID[] DEFAULT '{}',
  
  -- Metadados do look
  style_profile VARCHAR(100),
  occasion VARCHAR(100),
  confidence DECIMAL(3,2) DEFAULT 0.0,
  total_price DECIMAL(10,2),
  
  -- Try-on gerado
  tryon_image_url TEXT,
  tryon_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  tryon_generated_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  tryon_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_look_compositions_org ON look_compositions(org_id);
CREATE INDEX IF NOT EXISTS idx_look_compositions_result ON look_compositions(result_id);
CREATE INDEX IF NOT EXISTS idx_look_compositions_lead ON look_compositions(lead_id);
CREATE INDEX IF NOT EXISTS idx_look_compositions_active ON look_compositions(is_active);
CREATE INDEX IF NOT EXISTS idx_look_compositions_featured ON look_compositions(is_featured);

-- Tabela: look_composition_interactions
CREATE TABLE IF NOT EXISTS look_composition_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  look_composition_id UUID NOT NULL REFERENCES look_compositions(id) ON DELETE CASCADE,
  lead_id UUID,
  session_id VARCHAR(255),
  
  -- Tipo de interação
  interaction_type VARCHAR(50) NOT NULL, -- view, tryon_click, tryon_generate, whatsapp_click, purchase_intent
  
  -- Dados da interação
  source_page VARCHAR(255),
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  
  -- Metadados específicos
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_look_interactions_look ON look_composition_interactions(look_composition_id);
CREATE INDEX IF NOT EXISTS idx_look_interactions_lead ON look_composition_interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_look_interactions_type ON look_composition_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_look_interactions_created ON look_composition_interactions(created_at);

-- Tabela: look_composition_conversions
CREATE TABLE IF NOT EXISTS look_composition_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  look_composition_id UUID NOT NULL REFERENCES look_compositions(id) ON DELETE CASCADE,
  lead_id UUID,
  
  -- Produtos comprados
  purchased_product_ids UUID[] NOT NULL,
  total_value DECIMAL(10,2),
  
  -- Origem
  source VARCHAR(100) DEFAULT 'whatsapp', -- whatsapp, direct, campaign
  whatsapp_conversation_id VARCHAR(255),
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, cancelled
  confirmed_at TIMESTAMPTZ,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_look_conversions_look ON look_composition_conversions(look_composition_id);
CREATE INDEX IF NOT EXISTS idx_look_conversions_lead ON look_composition_conversions(lead_id);
CREATE INDEX IF NOT EXISTS idx_look_conversions_status ON look_composition_conversions(status);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_look_composition_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para look_compositions
DROP TRIGGER IF EXISTS trigger_look_compositions_updated_at ON look_compositions;
CREATE TRIGGER trigger_look_compositions_updated_at
  BEFORE UPDATE ON look_compositions
  FOR EACH ROW
  EXECUTE FUNCTION update_look_composition_updated_at();

-- Função para incrementar contadores
CREATE OR REPLACE FUNCTION increment_look_composition_counter(
  look_id UUID,
  counter_name VARCHAR(50)
)
RETURNS VOID AS $$
BEGIN
  IF counter_name = 'view' THEN
    UPDATE look_compositions SET view_count = view_count + 1 WHERE id = look_id;
  ELSIF counter_name = 'tryon' THEN
    UPDATE look_compositions SET tryon_count = tryon_count + 1 WHERE id = look_id;
  ELSIF counter_name = 'conversion' THEN
    UPDATE look_compositions SET conversion_count = conversion_count + 1 WHERE id = look_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE look_compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE look_composition_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE look_composition_conversions ENABLE ROW LEVEL SECURITY;

-- Políticas para look_compositions
CREATE POLICY "Users can view their org look compositions"
  ON look_compositions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM org_members WHERE org_id = look_compositions.org_id AND user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage look compositions"
  ON look_compositions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM org_members WHERE org_id = look_compositions.org_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Políticas para look_composition_interactions
CREATE POLICY "Users can view their org look interactions"
  ON look_composition_interactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM look_compositions lc 
    WHERE lc.id = look_composition_interactions.look_composition_id
    AND EXISTS (SELECT 1 FROM org_members WHERE org_id = lc.org_id AND user_id = auth.uid())
  ));

-- Políticas para look_composition_conversions
CREATE POLICY "Users can view their org look conversions"
  ON look_composition_conversions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM look_compositions lc 
    WHERE lc.id = look_composition_conversions.look_composition_id
    AND EXISTS (SELECT 1 FROM org_members WHERE org_id = lc.org_id AND user_id = auth.uid())
  ));
