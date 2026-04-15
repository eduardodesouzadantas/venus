# CRM Operacional - Venus Engine

## Visão Geral

Este documento descreve o módulo CRM operacional do Venus Engine, permitindo que lojistas gerenciem leads com isolamento por tenant, timeline e integração com WhatsApp.

## Schema

### Tabela leads (existente +扩展)

| Coluna | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Chave primária |
| org_id | UUID | FK para orgs(id) |
| name | TEXT | Nome do lead |
| email | TEXT | Email (único por org) |
| phone | TEXT | Telefone (único por org) |
| source | TEXT | Origem (app, whatsapp, manual) |
| status | TEXT | Status do funil |
| saved_result_id | UUID | FK para saved_results(id) |
| intent_score | NUMERIC | Score 0-100 |
| whatsapp_key | TEXT | Telefone WhatsApp |
| next_follow_up_at | TIMESTAMPTZ | Próximo follow-up |
| notes | TEXT | **NOVO** Notas do lead |
| owner_user_id | UUID | **NOVO** Responsável |
| conversation_id | UUID | **NOVO** FK para whatsapp_conversations |
| created_at | TIMESTAMPTZ | Data de criação |
| updated_at | TIMESTAMPTZ | Data de atualização |
| last_interaction_at | TIMESTAMPTZ | Última interação |

### Tabela lead_timeline (nova)

| Coluna | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Chave primária |
| lead_id | UUID | FK para leads(id) |
| org_id | UUID | FK para orgs(id) |
| actor_user_id | UUID | Usuário que realizou ação |
| event_type | TEXT | Tipo de evento |
| event_data | JSONB | Dados do evento |
| created_at | TIMESTAMPTZ | Data do evento |

### Event Types de Timeline

- `created` - Lead criado
- `status_changed` - Status alterado
- `note_added` - Nota adicionada
- `assigned` - Responsável atribuído
- `conversation_linked` - Conversa vinculada
- `follow_up_scheduled` - Follow-up agendado
- `whatsapp_message` - Mensagem WhatsApp

### Funil de Vendas

| Status | Label | Descrição |
|--------|------|-----------|
| new | Novo | Lead recém-criado |
| engaged | Em conversa | Em conversa ativa |
| qualified | Qualificado |Lead qualificado |
| offer_sent | Proposta enviada | Proposta enviada |
| closing | Fechamento | Fechando negócio |
| won | Ganho | Negócio fechado |
| lost | Perdido | Perdido |

## APIs

### Listar Leads

```
GET /api/org/[slug]/leads
```

Parâmetros de query:
- `status` - Filtrar por status
- `source` - Filtrar por origem
- `search` - Buscar por nome/email/telefone
- `limit` - Limite (padrão: 50, máx: 100)
- `offset` - Offset para paginação

```json
{
  "leads": [...],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

### Detalhe do Lead

```
GET /api/org/[slug]/leads/[id]
```

```json
{
  "lead": { ... },
  "timeline": [...]
}
```

### Atualizar Lead

```
PATCH /api/org/[slug]/leads/[id]
```

Body:
```json
{
  "status": "engaged",
  "notes": "Cliente interessa no produto X",
  "owner_user_id": "uuid-do-responsavel",
  "next_follow_up_at": "2026-04-20T15:00:00Z"
}
```

## Isolamento por Tenant

### RLS Policies

```sql
-- Leitura: membros da org ou agency
CREATE POLICY "Merchant can read leads for org"
  ON leads FOR SELECT USING (
    tenant.is_merchant_user()
    AND org_id IN (SELECT id FROM orgs WHERE slug = tenant.current_org_slug())
  );

-- Escrita: mesmo isolamento
CREATE POLICY "Merchant can update leads for org"
  ON leads FOR UPDATE USING (...);
```

### Garantias

1. Queries sempre filtram por `org_id`
2. RLS adiciona camada de segurança
3. APIs verificam pertencimento à org

## Integração com WhatsApp

### Linking Automático

Quando um lead faz handoff via WhatsApp:
1. Sistema cria/atualiza lead
2. vincula `conversation_id` se existir
3. Registra evento em `lead_timeline`

### Busca por Telefone

```sql
-- Unique constraint
CREATE UNIQUE INDEX idx_leads_org_phone_unique 
  ON leads (org_id, phone) 
  WHERE phone IS NOT NULL AND phone <> '';
```

## Fluxo de Criação

### Via App (saved_result → lead)

1. Usuário completa onboarding
2. Sistema gera saved_result
3. Seed migração cria lead automaticamente
4. Link com saved_result via `saved_result_id`

### Via WhatsApp (handoff)

1. Usuário clica "Quero no WhatsApp"
2. Rota `/api/whatsapp-handoff` processa
3. Cria ou atualiza lead
4. Registra em timeline

### Via API (manual)

1. Merchant chama PATCH sem body ou com campos específicos
2. Sistema cria registro em timeline

## Testes

###isolamento por Tenant

```typescript
const org1Leads = [...];
const org2Leads = [...];

// Não vazam entre orgs
assert.ok(!org1Leads.find(l => l.org_id === "org-xyz"));
assert.ok(!org2Leads.find(l => l.org_id === "org-abc"));
```

### Filtros

- Por status: `filterByStatus("new")`
- Por origem: `filterBySource("whatsapp")`
- Por busca: `searchByTerm("Ana")`
- Por recência: `filterRecent(7)`

## Variáveis de Ambiente

Nenhuma variável nova necessária para CRM operacional.

## Checklist de Migração

- [ ] Executar migration `20260417000001_crm_operational.sql`
- [ ] Verificar RLS policies
- [ ] Testar listagem de leads
- [ ] Testar detalhe com timeline
- [ ] Testar atualização de status
- [ ] Testar isolamento cross-tenant
- [ ] Integrar com WhatsApp (se necessário)

## Limitações

- Sem gestão de contacts múltiplos por lead (futuro)
- Sem pipeline customizável (futuro)
- Sem atribuição automática a vendedor (futuro)