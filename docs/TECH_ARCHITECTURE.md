# Venus Engine — Tech Architecture

## Stack inicial
- Next.js
- TypeScript
- Tailwind
- shadcn/ui
- Supabase
- OpenAI / modelo multimodal para suporte à análise visual e texto
- PWA mobile-first

## Estrutura principal
- app/
- components/
- lib/
- hooks/
- types/
- docs/

## Áreas principais do produto
### app/(public)
- landing
- onboarding
- scanner
- result

### app/(auth)
- login
- signup

### app/(b2b)
- dashboard
- products
- settings

## Módulos lógicos
### lib/onboarding
- perguntas
- respostas
- normalização

### lib/photo-analysis
- regras de leitura visual
- composição do payload para IA
- validações

### lib/recommendation
- look generation logic
- hybrid recommendation engine
- accessory engine

### lib/catalog
- produtos
- filtros
- tags

### lib/result
- montagem do dashboard final

## Regras técnicas
- mobile-first sempre
- componentes reutilizáveis
- nada de lógica gigante dentro da página
- tipagem forte
- funções pequenas
- sem dependências desnecessárias
- sem features fora do escopo do MVP