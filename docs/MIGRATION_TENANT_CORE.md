# Migração do Tenant Core - Venus Engine

## Visão Geral

Esta migração implementa o **Tenant Core canônico** do Venus Engine, estabelecendo `org_id` como a verdade interna enquanto mantém `org_slug` para compatibilidade temporária com rotas e APIs externas.

## Objetivos

1. **Eliminar fragmentação** entre `org_slug`, `org_id`, `b2b_user_id` e `localStorage`
2. **Reduzir risco de vazamento de dados** entre lojas (tenants)
3. **Preparar base** para billing, CRM, agency admin e enforcement server-side
4. **Manter compatibilidade** com o fluxo atual do WhatsApp

## Schema Canônico

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `orgs` | Registro canônico de tenant (organização/loja) |
| `org_members` | Associação usuário ↔ tenant com role |
| `org_invites` | Convites pendentes para organizações |
| `org_usage_daily` | Métricas diárias de uso por tenant |
| `tenant_events` | Logs estruturados de eventos de tenant |

### Campos Obrigatórios

```sql
-- orgs
id UUID PRIMARY KEY        -- org_id canônico (verdade interna)
slug TEXT UNIQUE          -- identificador público (compatibilidade)
name TEXT
status TEXT              -- 'active' | 'suspended' | 'blocked'
kill_switch BOOLEAN      -- pause administrativa
plan_id TEXT            -- plano atual
limits JSONB           -- limites do plano
owner_user_id UUID      -- proprietário

-- org_members
org_id UUID REFERENCES orgs(id)
user_id UUID REFERENCES auth.users(id)
role TEXT               -- 'agency_*' | 'merchant_*'
status TEXT             -- 'active' | 'invited' | 'suspended' | 'blocked'
```

## Funções SQL Canônicas

```sql
-- Retorna org_id do JWT atual
tenant.current_org_id() → UUID

-- Retorna org_slug do JWT atual (compatibilidade)
tenant.current_org_slug() → TEXT

-- Retorna role do JWT atual
tenant.current_role() → TEXT

-- Verifica se usuário é agency
tenant.is_agency_user() → BOOLEAN

-- Verifica se usuário é merchant
tenant.is_merchant_user() → BOOLEAN

-- Resolve org_id a partir de slug
tenant.org_id_from_slug(slug TEXT) → UUID
```

## Middleware/Guards de Validação

### Níveis de Validação

1. **Autenticação**: Usuário logado?
2. **Membership**: Usuário pertence ao tenant?
3. **Role**: Usuário tem role adequada?
4. **Status (org)**: Tenant está ativo?
5. **Kill Switch**: Tenant não está pausado?

### Tipos de Guard

```typescript
// Guard básico
validateGuard(supabase, {
  requireAuthenticated: true,
  requireOrgId: "org-123",
  requireTenantActive: true,
}) → GuardValidationResult

// Guard com role específica
validateGuard(supabase, {
  requireAuthenticated: true,
  requireOrgId: "org-123",
  requireRoles: ["merchant_owner", "merchant_manager"],
  requireTenantActive: true,
}) → GuardValidationResult

// Guard que lança exceção
requireGuard(supabase, requirements) → GuardValidationResult
```

## Fluxo de Provisioning

### merchant-provision

1. Criar/atualizar usuário no Supabase Auth
2. Criar/atualizar registro em `orgs` (upsert por slug)
3. Criar/atualizar membership em `org_members` (upsert por org_id, user_id)
4. Criar/inicializar `org_usage_daily`
5. Registrar evento em `tenant_events`
6. **Propagar org_id canônico para metadata do auth**

### Metadata do Auth

```typescript
//app_metadata
{
  org_slug: "minha-loja",      // compatibilidade (slug público)
  org_id: "org-abc123...",    // UUID canônico (verdade interna)
  role: "merchant_owner",
  plan_id: "starter",
  tenant_source: "merchant_provision"
}
```

## Camadas de Segurança

### 1. RLS (Row Level Security)

```sql
-- orgs: membros leem própria org; agency gerencia todas
CREATE POLICY "Org members can read own org or agency"
  ON orgs FOR SELECT USING (
    tenant.is_agency_user() OR slug = tenant.current_org_slug()
  );

-- org_members: mesma lógica
CREATE POLICY "Members can read membership or agency"
  ON org_members FOR SELECT USING (
    tenant.is_agency_user() OR org_id = tenant.current_org_id()
  );
```

### 2. Guards Server-Side

- Toda autorização em server-side (nunca client-side)
- ValidateGuard antes de qualquer operação crítica
- Verificação de status/kill_switch antes de operações

### 3. Enforced Operations

```typescript
// Antes de qualquer operação:
await enforceTenantOperationalState({
  orgId: "org-123",
  operation: "catalog_product_creation",
});
```

## Migração de Dados Existentes

### products

```sql
-- Adicionar org_id baseado em b2b_user_id
UPDATE products p
SET org_id = (
  SELECT om.org_id
  FROM org_members om
  WHERE om.user_id = p.b2b_user_id
  WHERE p.org_id IS NULL;
```

### saved_results

```sql
-- Similar para saved_results
```

## Status de Tenant

| Status | Descrição | Operações |
|--------|----------|-----------|
| `active` | Normal | Permitidas |
| `suspended` | Suspenso | Bloqueadas |
| `blocked` | Bloqueado | Bloqueadas |

### Kill Switch

- Pausa administrativa imediata
- Define `kill_switch = true` em `orgs`
- Bloqueia todas operações
-Mantém acesso para administradores agency

## Eventos Estruturados

```sql
-- Tipos de evento
'tenant_provisioned'
'tenant_backfilled'
'tenant.updated'
'tenant.suspended'
'tenant.blocked'
'tenant.operational_blocked'
```

## Testes

### Unit Tests (test/tenant/core.test.ts)

- `normalizeTenantSlug`
- `resolveTenantContext`
- `isTenantActive`
- `getTenantOperationalError`
- Funções de role (canManageOrg, canEditCatalog, etc.)

### Integration Tests (test/tenant/guards.test.ts)

- Validar usuário não autenticado
- Validar membership
- Validar role
- Validar status/kill_switch

## Backward Compatibility

### Mantido

- `org_slug` em rotas (`/org/[slug]`)
- `org_slug` em JWT metadata
- `org_slug` em URL params

### Novo

- `org_id` como referência canônica
- `org_id` em app_metadata
- `org_id` em Foreign Keys

## Limites Default

```typescript
const DEFAULT_TENANT_LIMITS = {
  ai_tokens_monthly: 250_000,
  whatsapp_messages_daily: 1_000,
  products: 500,
  leads: 10_000,
};
```

## Checklist de Migração

- [ ] Executar migration SQL (supabase/migrations/20260415000001_tenant_core.sql)
- [ ] Verificar RLS policies
- [ ] Testar provisioning route
- [ ] Validar middleware redirects
- [ ] Testar guards
- [ ] Migrar products.org_id
- [ ] Migrar saved_results.org_id
- [ ] Executar testes
- [ ] Deploy para produção

## Rollback

Em caso de necessidade de rollback:

1. Executar SQL para reverter constraints (se necessário)
2. Manter backward compatibility: `org_slug` continua funcionado
3. Operações críticas continuam bloqueadas por guards existentes