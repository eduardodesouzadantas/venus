# Gamificação Budget-Aware v1 - Venus Engine

## Visão Geral

A Gamificação Budget-Aware v1 permite que lojistas configurem e distribuam benefícios para clientes finais (como try-ons extras e bônus de uso), respeitando os limites de recursos definidos pela agência por tenant.

## Arquitetura

### Princípios Fundamentais

1. **Budget-Aware**: Toda concessão respeita os limites da agência e da loja via Resource Control Engine
2. **Tenant-Isolated**: Nenhum vazamento de dados entre tenants
3. **Auditável**: Todas as concessões e consumos são registrados com trilha completa de auditoria
4. **Regras Declarativas**: Motor simples baseado em regras, não em lógica complexa

### Componentes

```
src/lib/gamification/
├── index.ts              # Core: regras, concessões, consumos, saldo
├── events.ts             # Eventos automáticos e triggers
└── integration.ts        # Integração com eventos do sistema
```

### Persistência

```sql
gamification_rules       # Regras por org
gamification_events      # Eventos (concessões, consumos, bloqueios)
```

## Funcionalidades

### 1. Regras de Gamificação

#### Tipos de Regras Disponíveis

- **share_bonus**: Bônus por compartilhamento de resultado
- **return_after_days**: Bônus por retornar após X dias
- **onboarding_complete**: Bônus por completar onboarding
- **recurring_interaction**: Bônus por interação recorrente
- **purchase_confirmed**: Bônus por compra confirmada

#### Modos de Trigger

- **manual**: Concessão manual pelo lojista
- **automatic**: Concessão automática quando evento ocorre

#### Eventos Automáticos Suportados

- `onboarding_completed`: Quando cliente completa onboarding
- `lead_reengaged`: Quando lead é reengajado
- `result_shared`: Quando resultado é compartilhado

#### Recursos Concedidos

- `try_on`: Try-ons extras
- `whatsapp_message`: Mensagens premium
- `ai_tokens`: Tokens de IA

### 2. Configuração de Regras

Cada regra contém:

```typescript
{
  rule_type: "share_bonus" | "return_after_days" | ...
  trigger_mode: "manual" | "automatic"
  trigger_event_type: "onboarding_completed" | "result_shared" | ...
  benefit_resource_type: "try_on" | "whatsapp_message" | "ai_tokens"
  benefit_amount: number                    // Quantidade concedida
  per_customer_limit: number                // Limite por cliente
  per_customer_period_days: number          // Período do limite
  valid_from: string                        // Início da validade
  valid_until: string | null                // Fim da validade (opcional)
  active: boolean                           // Regra ativa/inativa
  label: string                             // Nome da regra
  description: string | null                // Descrição
}
```

### 3. Controle de Budget

#### Validações em Cascata

1. **Regra Ativa**: Verifica se regra está ativa e dentro da validade
2. **Limite por Cliente**: Verifica se cliente não excedeu limite no período
3. **Budget da Agência**: Verifica `canConsumeResource()` do Resource Control Engine
4. **Kill Switch**: Respeita kill switch do tenant

#### Fluxo de Concessão

```
1. Validar regra e parâmetros
2. Verificar duplicidade (para eventos automáticos)
3. Verificar limite por cliente no período
4. Verificar budget via Resource Control Engine
5. Consumir recurso do budget da org
6. Registrar evento de concessão (success ou blocked)
7. Registrar auditoria e evento operacional
```

### 4. Consumo de Benefícios

Quando cliente usa o benefício:

```
1. Verificar saldo disponível do cliente
2. Se suficiente: registrar consumo e reduzir saldo
3. Se insuficiente: bloquear e registrar evento de bloqueio
4. NÃO debita budget da org novamente (já foi debitado na concessão)
```

### 5. Saldo do Cliente

Cada cliente tem saldo por recurso:

```typescript
{
  customer_key: string
  resources: {
    try_on: { granted: 5, consumed: 2, available: 3 }
    whatsapp_message: { granted: 10, consumed: 0, available: 10 }
    ai_tokens: { granted: 1000, consumed: 500, available: 500 }
  }
}
```

## API

### Endpoints

#### `GET /api/org/[slug]/gamification`

Retorna visão completa da gamificação:
- Regras ativas/inativas
- Eventos recentes
- Clientes recompensados
- Budget consumido/restante

#### `POST /api/org/[slug]/gamification`

Mutations (form ou JSON):

**Criar Regra:**
```json
{
  "intent": "create_rule",
  "rule_type": "share_bonus",
  "trigger_mode": "manual",
  "benefit_resource_type": "try_on",
  "benefit_amount": 2,
  "per_customer_limit": 3,
  "per_customer_period_days": 30,
  "label": "Bônus por share",
  "active": true,
  "redirect_to": "/org/[slug]/gamification"
}
```

**Conceder Benefício:**
```json
{
  "intent": "grant_benefit",
  "rule_id": "rule-uuid",
  "customer_key": "+5511999999999",
  "amount": 2,
  "reason": "Share confirmado"
}
```

**Consumir Benefício:**
```json
{
  "intent": "consume_benefit",
  "customer_key": "+5511999999999",
  "resource_type": "try_on",
  "amount": 1,
  "reason": "Try-on usado"
}
```

#### `POST /api/org/[slug]/gamification/events`

Processar evento automático de gamificação:

```json
{
  "event_type": "result_shared",
  "customer_key": "+5511999999999",
  "customer_label": "Maria Silva",
  "payload": {
    "share_id": "share-123",
    "saved_result_id": "result-456"
  }
}
```

Resposta:
```json
{
  "processed": true,
  "granted": 1,
  "blocked": 0,
  "duplicates": 0,
  "skipped": false,
  "skippedReason": null,
  "eventKey": "org-uuid:result_shared:customer-uuid:share-123"
}
```

### Funções Server-Side

```typescript
import {
  createGamificationRule,
  updateGamificationRule,
  grantGamificationBenefit,
  consumeGamificationBenefit,
  getGamificationCustomerBalance,
  loadGamificationOverview,
  listGamificationRules,
} from "@/lib/gamification";

import {
  processGamificationIntegrationEvent,
  resultSharedWithGamification,
  onboardingCompletedWithGamification,
} from "@/lib/gamification/integration";
```

## UI do Lojista

### Rota: `/org/[slug]/gamification`

O painel do lojista mostra:

1. **KPIs**:
   - Regras ativas/inativas
   - Regras automáticas
   - Clientes recompensados recentemente
   - Budget promocional concedido/restante
   - Bloqueios por falta de budget

2. **Criar Nova Regra**:
   - Formulário com todos os campos necessários
   - Validação server-side
   - Preview do impacto

3. **Regras Ativas**:
   - Lista com status
   - Toggle para ativar/desativar
   - Métricas de uso

4. **Regras Inativas**:
   - Histórico preservado
   - Opção de reativar

5. **Conceder Benefício** (modo interno):
   - Selecionar regra
   - Informar cliente
   - Validar budget antes de conceder

6. **Consumir Saldo**:
   - Quando cliente usa benefício
   - Registrar consumo sem debitar budget novamente

7. **Budget por Recurso**:
   - Visualização do saldo por tipo de recurso
   - Concedido vs Consumido vs Disponível

8. **Clientes Recompensados**:
   - Lista dos clientes com saldo atual
   - Último evento

## Integração com Eventos do Sistema

### Eventos Suportados

A gamificação pode ser triggerada automaticamente por:

1. **Onboarding Completado**
   ```typescript
   await onboardingCompletedWithGamification(
     orgId,
     customerKey,
     customerLabel,
     leadId
   );
   ```

2. **Resultado Compartilhado**
   ```typescript
   await resultSharedWithGamification(
     orgId,
     customerKey,
     customerLabel,
     shareId
   );
   ```

3. **Lead Reengajado**
   ```typescript
   await leadReengagedWithGamification(
     orgId,
     customerKey,
     customerLabel,
     leadId
   );
   ```

4. **Try-on Completado**
   ```typescript
   await tryonCompletedWithGamification(
     orgId,
     customerKey,
     customerLabel,
     savedResultId
   );
   ```

### Configuração de Feature Flag

Para desabilitar gamificação:

```env
GAMIFICATION_BUDGET_AWARE_ENABLED=false
```

Para desabilitar eventos automáticos:

```env
GAMIFICATION_EVENT_DRIVEN_ENABLED=false
```

## Auditoria

### Eventos Registrados

Toda operação de gamificação registra:

1. **Audit Log** (via `logAudit`):
   - orgId, userId, ação, recurso
   - Metadata completa
   - Status (success/blocked)

2. **Tenant Event** (via `recordOperationalTenantEvent`):
   - eventType específico
   - dedupeKey para idempotência
   - Payload estruturado

3. **Gamification Event**:
   - Tabela `gamification_events`
   - Tipo: `grant`, `consume`, `block`, `rule_create`, `rule_update`, `rule_deactivate`
   - Status: `success`, `blocked`, `pending`
   - Metadata completa

### Exemplos de Auditoria

```typescript
// Concessão bem-sucedida
{
  action: "gamification_benefit_grant",
  status: "success",
  metadata: {
    rule_id: "uuid",
    rule_label: "Bônus por share",
    customer_key: "+5511999999999",
    resource_type: "try_on",
    amount: 2,
    reason: "Share confirmado"
  }
}

// Concessão bloqueada por budget
{
  action: "gamification_benefit_blocked",
  status: "blocked",
  metadata: {
    rule_id: "uuid",
    reason: "Budget promocional insuficiente",
    budget: { allowed: false, ... }
  }
}

// Consumo de benefício
{
  action: "gamification_benefit_consume",
  status: "success",
  metadata: {
    customer_key: "+5511999999999",
    resource_type: "try_on",
    amount: 1,
    balance_before: 3
  }
}
```

## Testes

### Executar Testes

```bash
npm test
```

### Cobertura de Testes

Os testes cobrem:

- ✅ Criação e edição de regras por tenant
- ✅ Negação para usuário sem autorização
- ✅ Concessão de benefício com budget suficiente
- ✅ Bloqueio de concessão quando limite está esgotado
- ✅ Consumo de benefício pelo cliente
- ✅ Auditoria registrada corretamente
- ✅ Isolamento entre tenants
- ✅ Compatibilidade com Resource Control Engine
- ✅ Fallback seguro quando dados estão incompletos
- ✅ Eventos automáticos e manuais
- ✅ Expiração de benefícios
- ✅ Ordenação cronológica correta (grant antes de consume)

## Rollout

### Fase 1: Modo Interno (Atual)

- ✅ Criação de regras
- ✅ Concessão manual de benefícios
- ✅ Leitura de saldo
- ✅ Painel do lojista básico

### Fase 2: Automação

- ✅ Concessão automática por evento
- ✅ Endpoint de eventos automáticos
- ⏳ Visualização avançada no dashboard

### Fase 3: Integração com Campanhas

- ⏳ Conectar com campanhas existentes
- ⏳ Jornadas automáticas
- ⏳ Follow-ups com benefícios

## Rollback

Para desabilitar gamificação rapidamente:

1. **Feature Flag**:
   ```env
   GAMIFICATION_BUDGET_AWARE_ENABLED=false
   ```

2. **Ocultar UI**: Redireciona `/org/[slug]/gamification` para dashboard

3. **Manter Schema**: Tabelas permanecem (backward-compatible)

4. **Rotas Isoladas**: Não afetam fluxo principal de compra

## Monitoramento

### Métricas a Acompanhar

1. **Recompensas Concedidas**:
   - Por loja
   - Por tipo de recurso
   - Por período

2. **Budget Promocional**:
   - Consumido por recurso
   - Restante por loja
   - Taxa de utilização

3. **Bloqueios**:
   - Por falta de budget da agência
   - Por falta de budget da loja
   - Por limite de cliente excedido

4. **Erros**:
   - Tentativas de concessão falhas
   - Tentativas negadas por autorização
   - Vazamentos de tenant (deve ser zero)

### Alerts Recomendados

- Budget promocional > 80% consumido
- Bloqueios consecutivos > 10 em 1 hora
- Erros de autorização > 5 em 10 minutos
- Vazamento de tenant (CRÍTICO, deve ser zero)

## Métricas de Sucesso

### Esperado Após Implementação

1. **Reengajamento**:
   - ↑ Retorno de clientes após X dias
   - ↑ Interações recorrentes

2. **Try-ons**:
   - ↑ Try-ons por cliente (com teto controlado)
   - ↑ Qualidade dos try-ons (mais engajamento)

3. **Compartilhamento**:
   - ↑ Compartilhamentos de resultado
   - ↑ Leads via referral

4. **Conversão**:
   - ↑ Conversão pós-recompensa
   - ↑ Fechamento de leads recompensados

5. **Zero Consumo Fora do Budget**:
   - ✓ Todas as concessões respeitam limites
   - ✓ Zero vazamento entre tenants
   - ✓ Auditoria completa

## Restrições Arquiteturais

### O que NÃO foi alterado

- ❌ Pipeline principal de try-on
- ❌ Billing core
- ❌ Catálogo core
- ❌ Campanhas automáticas (além da integração necessária)
- ❌ Dashboard da agência
- ❌ Lógica core de ROI
- ❌ Rate limiting distribuído
- ❌ Enforcement principal de recursos

### O que foi reutilizado

- ✅ Resource Control Engine (`canConsumeResource`, `consumeResource`)
- ✅ Tenant core (isolation, RBAC)
- ✅ Audit log existente
- ✅ Observabilidade existente
- ✅ Guard/authorization patterns

## Segurança

### RLS Policies

Todas as tabelas de gamificação têm:

```sql
-- Leitura: agency vê tudo, merchant vê apenas sua org
USING (
  tenant.is_agency_user()
  OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
)

-- Escrita: mesma lógica
WITH CHECK (
  tenant.is_agency_user()
  OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
)
```

### Validações

- ✅ Server-side only (nada de validação client-side para budget)
- ✅ Tenant isolation em todas as operações
- ✅ RBAC check antes de mutações
- ✅ Idempotência via source_event_key
- ✅ Rate limiting via Resource Control Engine

## Troubleshooting

### Benefício não sendo concedido

1. Verificar se regra está ativa: `active = true`
2. Verificar validade: `valid_from <= now() <= valid_until`
3. Verificar budget da org: `SELECT * FROM org_resource_limits WHERE org_id = ?`
4. Verificar uso da org: `SELECT * FROM org_resource_usage WHERE org_id = ?`
5. Verificar kill switch: `SELECT kill_switch FROM orgs WHERE id = ?`

### Evento automático não disparando

1. Verificar feature flag: `GAMIFICATION_EVENT_DRIVEN_ENABLED`
2. Verificar se regra é automática: `trigger_mode = 'automatic'`
3. Verificar se trigger_event_type corresponde
4. Verificar duplicidade: `SELECT * FROM gamification_events WHERE source_event_key = ?`

### Saldo do cliente incorreto

1. Reconstruir ledger: somar todos os grants e subtrair consumes
2. Verificar expiração: eventos com `expires_at < now()` não contam
3. Verificar ordenação: grants antes de consumes no mesmo timestamp

## Futuro (v2)

### Melhorias Planejadas

- [ ] UI de configuração visual de regras
- [ ] Templates de regras pré-configurados
- [ ] A/B testing de benefícios
- [ ] Machine learning para otimizar concessões
- [ ] Budget forecasting
- [ ] Alertas proativos de budget
- [ ] Integração com WhatsApp automation
- [ ] Gamification leaderboards
- [ ] Badges e achievements visuais
- [ ] Multi-step rewards (progressão de níveis)

## Contribuindo

Ao adicionar novas funcionalidades de gamificação:

1. Sempre respeitar tenant isolation
2. Sempre passar pelo Resource Control Engine para budget
3. Sempre registrar auditoria completa
4. Manter regras declarativas e simples
5. Adicionar testes cobrindo:
   - Casos de sucesso
   - Casos de bloqueio
   - Isolamento de tenant
   - Edge cases (expiração, limites, etc.)

## Referências

- [Resource Control Engine](../src/lib/resource-control/index.ts)
- [Tenant Core](../src/lib/tenant/core.ts)
- [Security Audit](../src/lib/security/audit.ts)
- [Observability](../src/lib/reliability/observability.ts)
- [Migration SQL](../supabase/migrations/20260421000002_gamification_budget_aware_v1.sql)
