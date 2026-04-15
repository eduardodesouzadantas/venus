# Billing Operacional - Venus Engine

## Visão Geral

Este documento descreve o sistema de billing operacional do Venus Engine, incluindo assinatura, ledger de uso e enforcement server-side.

## Arquitetura

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `billing_subscriptions` | Persistência de assinaturas por org |
| `billing_payment_events` | Ledger de eventos de pagamento com idempotência |
| `billing_invoices` | Faturas persistidas do Stripe |

### Schema

```sql
-- billing_subscriptions (existente)
org_id TEXT PRIMARY KEY
billing_status TEXT
stripe_customer_id TEXT
stripe_subscription_id TEXT
stripe_checkout_session_id TEXT
stripe_price_id TEXT
stripe_cancel_at_period_end BOOLEAN
stripe_current_period_end TIMESTAMPTZ

-- Novas colunas
grace_period_until TIMESTAMPTZ
grace_period_enabled BOOLEAN
payment_retry_count SMALLINT
last_payment_error TEXT
```

## Fluxo de Assinatura

### 1. Checkout

```
[Client] -> POST /api/agency/billing/checkout
  -> Cria Stripe Checkout Session
  -> Retorna URL de checkout
[Client] -> Stripe Checkout
  -> Redirect para success/cancel URL
```

### 2. Webhook (Idempotente)

```
[Stripe] -> POST /api/stripe/webhook
  -> Verifica assinatura Stripe
  -> Verifica idempotência (stripe_event_id)
  ->Upsert billing_subscription
  -> Upsert billing_payment_event
  -> Upsert billing_invoice (se aplicável)
  -> Atualiza org.plan_id
  -> Atualiza org.kill_switch
```

### 3. Estados de Billing

| Status | Descrição | Operações |
|--------|----------|-----------|
| `active` | Assinatura ativa | Permitidas |
| `trialing` | Período trial | Permitidas |
| `past_due` | Pagamento pendente | Bloqueadas (grace period) |
| `unpaid` | Não pago | Bloqueadas |
| `canceled` | Cancelado | Bloqueadas após período |
| `inactive` | Inativo (free tier) | Permitidas com limites |

## Sistema de Enforcement

### Limites por Plano

```typescript
const PLAN_SOFT_CAPS = {
  free: { saved_results: 10, leads: 5, products: 20 },
  starter: { saved_results: 40, leads: 20, products: 100 },
  growth: { saved_results: 150, leads: 80, products: 300 },
  scale: { saved_results: 300, leads: 150, products: 600 },
  enterprise: { saved_results: 1000, leads: 500, products: 2000 },
};
```

### Operações Monitoradas

```typescript
type HardCapOperation =
  | "saved_result_generation"
  | "ai_recommendation_generation"
  | "catalog_product_creation"
  | "whatsapp_handoff_sync";
```

## Grace Period

### Configuração

```bash
# Variável de ambiente (opcional)
BILLING_GRACE_PERIOD_DAYS=7
```

### Lógica

1. **Pagamento falha** (`invoice.payment_failed`)
2. Habilita grace period (7 dias por padrão)
3. Não ativa kill_switch imediatamente
4. Após grace period expirar → ativa kill_switch

### Funções SQL

```sql
-- Verifica se org está em grace period
SELECT is_org_in_grace_period('org-id');

-- Retorna configuração de grace period
SELECT resolve_billing_grace_period();
```

## Kill Switch Automático

### Condições de Ativação

| Condição | Ação |
|----------|------|
| `past_due` sem grace period | Ativa kill_switch |
| `unpaid` sem grace period | Ativa kill_switch |
| `canceled` + período expirado | Ativa kill_switch |

### Condições de Desativação

| Condição | Ação |
|----------|------|
| Status retorna `active` | Desativa kill_switch |
| Status retorna `trialing` | Desativa kill_switch |
| Checkout concluído | Desativa kill_switch |

## Idempotência

### Estratégia

1. `billing_payment_events.stripe_event_id` UNIQUE
2. Verificação antes de processar
3. Skip se evento já existir

### Exemplo

```typescript
const existingEvent = await queryWithTimeout(
  admin.from("billing_payment_events")
    .select("id")
    .eq("stripe_event_id", `checkout_${session.id}`)
    .maybeSingle(),
  { data: null, error: null }
);

if (existingEvent.data) {
  console.log("Event already processed, skipping");
  return;
}
```

## Webhook Events

### Eventos Tratados

| Evento | Ação |
|--------|------|
| `checkout.session.completed` | Ativa assinatura, atualiza plan_id |
| `customer.subscription.created` | Cria/atualiza subscription |
| `customer.subscription.updated` | Atualiza status, plan_id |
| `customer.subscription.deleted` | Marca como cancelado |
| `invoice.payment_failed` | Habilita grace period, ativa kill_switch |

## Testes

### Testes Incluídos

- Normalização de status Stripe
- Verificação de status bloqueantes
- Limites por plano
- Grace period logic
- Kill switch automation

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `STRIPE_SECRET_KEY` | Chave secreta Stripe |
| `STRIPE_WEBHOOK_SECRET` | Segredo do webhook |
| `STRIPE_PRICE_ID_*` | IDs de preço por plano |
| `BILLING_GRACE_PERIOD_DAYS` | Dias de grace (padrão: 7) |
| `BILLING_ENFORCEMENT_DISABLED` | Desabilita enforcement |

## Rollback

Em caso de problemas:

1. Webhook já é idempotente - reprocessar é seguro
2. Grace period evita bloqueios imediatos
3. Desativar `BILLING_ENFORCEMENT_DISABLED=true` para dev
4. Atualizar `billing_subscriptions` manualmente

## Checklist de Migração

- [ ] Executar migration `20260416000001_billing_ledger.sql`
- [ ] Configurar variáveis de ambiente Stripe
- [ ] Testar webhook localmente
- [ ] Verificar idempotência
- [ ] Testar grace period
- [ ] Testar kill switch automation
- [ ] Configurar alerts para falhas de pagamento