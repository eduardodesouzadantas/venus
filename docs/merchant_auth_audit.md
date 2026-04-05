# Merchant Auth Audit

## Leitura atual
Use a rota administrativa de backfill em modo leitura:

```http
POST /api/admin/merchant-backfill
Header: x-venus-backfill-secret: <WHATSAPP_BACKFILL_SECRET>
Body:
{
  "dry_run": true,
  "default_org_slug": "maison-elite"
}
```

## Campos do relatório
- `merchant_users`: total de contas merchant encontradas
- `already_canonical`: merchants com metadata canônico
- `missing_metadata`: merchants sem `org_slug/org_id` em `app_metadata` e `user_metadata`
- `needs_backfill`: merchants que ainda precisam de correção, mas não entram em conflito
- `conflicts`: merchants com `app_metadata` e `user_metadata` divergentes
- `canonical_rate`: proporção de merchants já canônicos

## Regra de decisão
Considere a base apta para operação somente com metadata canônico quando:
- `missing_metadata` for zero ou próximo de zero
- `conflicts` for zero
- `canonical_rate` estiver estável em 100% para merchants ativos

## Interpretação
- Se `missing_metadata > 0`, ainda existe base antiga sem metadata canônico
- Se `conflicts > 0`, o backfill não está seguro para operação total
- Se `needs_backfill > 0` mas `missing_metadata == 0`, existe metadata parcial ou inconsistência leve que deve ser corrigida antes da remoção final

## Próximo passo após o audit
- Rodar o relatório em dry run
- Corrigir conflitos manualmente
- Revalidar login, inbox, RLS e realtime
