# Merchant Auth Backfill

## Objetivo
Corrigir contas merchant antigas no Supabase Auth para que o tenant do WhatsApp seja resolvido pelo metadata canônico.

## Fonte canônica usada
- Merchant role em `app_metadata.role` ou `user_metadata.role`
- Tenant canônico atual do produto: `maison-elite`
- Metadata do usuário no Supabase Auth:
  - `app_metadata.org_slug`
  - `app_metadata.org_id`
  - `user_metadata.org_slug`
  - `user_metadata.org_id`

## Como executar
Chamar a rota administrativa:

```bash
POST /api/admin/merchant-backfill
Header: x-venus-backfill-secret: <WHATSAPP_BACKFILL_SECRET>
Body:
{
  "dry_run": true,
  "default_org_slug": "maison-elite"
}
```

Para aplicar de fato:

```json
{
  "dry_run": false,
  "default_org_slug": "maison-elite"
}
```

## O que a rotina faz
- Lista usuários do Supabase Auth em páginas
- Filtra apenas `merchant_*`
- Se `org_slug`/`org_id` estiverem ausentes, preenche com o tenant canônico
- Se `app_metadata` e `user_metadata` divergirem, marca conflito e não altera por padrão
- Mantém `email_confirm=true` ao atualizar usuários reparados

## Casos cobertos
- Merchant com metadata correta
  - permanece como está
- Merchant antigo sem metadata
  - recebe `org_slug/org_id` em `app_metadata` e `user_metadata`
- Merchant com mismatch
  - é reportado como conflito para revisão manual

## Limitações
- A rotina depende de uma `WHATSAPP_BACKFILL_SECRET` válida no servidor
- Mismatch entre metadados não é corrigido automaticamente
- A lógica assume `maison-elite` como tenant merchant canônico atual
- Contas fora do padrão `merchant_*` ficam fora do backfill

## Impacto esperado
- Menos bloqueios na autenticação oficial do WhatsApp
- RLS continua funcionando porque o JWT passa a carregar o tenant canônico
