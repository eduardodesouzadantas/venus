# Venus Engine — Photo Analysis Spec

## Objetivo
Definir como o Venus Engine deve usar fotos do usuário para enriquecer o diagnóstico de estilo sem substituir o onboarding textual.

A análise por foto deve complementar:
- coloração pessoal
- contraste visual
- proporções corporais gerais
- linhas predominantes do rosto
- harmonia entre rosto, cabelo e acessórios
- percepção de imagem

A análise por foto nunca deve:
- fazer diagnóstico médico
- fazer julgamento depreciativo do corpo
- afirmar traços psicológicos como verdade absoluta apenas pela imagem
- constranger o usuário

---

## Entradas esperadas

### Foto 1 — Rosto frontal
Requisitos:
- boa iluminação
- sem filtro
- sem óculos escuros
- fundo neutro se possível
- rosto visível

### Foto 2 — Corpo / espelho
Requisitos:
- corpo visível da cabeça aos pés, quando possível
- roupa ajustada o suficiente para leitura de proporções
- postura natural
- sem filtro
- fundo simples

### Foto 3 — opcional
- outro ângulo
- look que o usuário usa com frequência

---

## O que a IA deve analisar

### 1. Coloração e contraste
Objetivo:
- estimar temperatura visual predominante
- estimar profundidade
- estimar contraste geral
- sugerir famílias de cores mais favoráveis

Saídas esperadas:
- contraste: baixo / médio / alto
- temperatura visual estimada: mais quente / mais fria / neutra
- intensidade recomendada: suave / média / intensa
- metais sugeridos: dourado / prateado / misto

Observação:
A IA deve tratar isso como estimativa visual e não como laudo definitivo.

---

### 2. Estrutura facial e visagismo
Objetivo:
- identificar linhas predominantes do rosto
- sugerir decotes, golas, óculos, brincos e acessórios compatíveis

Saídas esperadas:
- linhas predominantes: suaves / equilibradas / marcantes
- formato facial estimado: oval / arredondado / alongado / angular / misto
- recomendações de parte superior:
  - golas
  - colares
  - brincos
  - óculos

---

### 3. Estrutura corporal geral
Objetivo:
- observar proporções amplas de forma respeitosa
- sugerir modelagens e caimentos mais harmônicos

Saídas esperadas:
- leitura geral de proporção
- recomendação de caimento:
  - mais estruturado
  - equilibrado
  - mais fluido
- sugestões de peças que valorizam a presença do usuário
- sugestões do que evitar caso não favoreça a intenção de imagem

Observação:
A IA deve falar em proporção, caimento e harmonia, nunca em defeito.

---

### 4. Leitura de imagem percebida
Objetivo:
- cruzar imagem visual com respostas do onboarding
- entender se a imagem atual reforça ou enfraquece a intenção desejada

Saídas esperadas:
- imagem atual percebida
- distância entre imagem atual e imagem desejada
- ajustes prioritários para aproximar a percepção desejada

---

### 5. Acessórios
Objetivo:
- sugerir escala e estilo de acessórios compatíveis com a leitura visual

Saídas esperadas:
- acessórios discretos / médios / marcantes
- metais
- formatos mais harmônicos
- ponto focal ideal:
  - óculos
  - colar
  - brincos
  - relógio
  - bolsa
  - sapato

---

## O que NÃO pode depender apenas da foto
Os itens abaixo devem ser definidos usando foto + onboarding textual:

- comportamento de compra
- estilo de vida
- intenção de imagem
- inseguranças
- preferências emocionais
- análise comportamental
- análise psicológica

A IA nunca deve afirmar perfil psicológico apenas pela aparência.
Ela pode apenas cruzar:
- respostas do onboarding
- escolhas visuais
- padrões declarados pelo usuário

---

## Fluxo ideal

1. Usuário responde onboarding
2. Usuário envia fotos
3. IA faz leitura visual complementar
4. Sistema cruza onboarding + foto
5. Sistema gera resultado final com:
   - estilo dominante
   - paleta estimada
   - visagismo
   - proporção e caimento
   - acessórios
   - 3 looks completos
   - direção prática de compra

---

## Regras de UX
- a captura de foto deve parecer premium, simples e segura
- a interface deve explicar por que cada foto ajuda
- o usuário deve sentir evolução, não julgamento
- toda análise deve terminar em orientação útil e acionável

---

## Regra final
A análise por foto é um amplificador de precisão.
Ela não substitui a inteligência do onboarding.
O resultado final sempre vem do cruzamento entre imagem + contexto + intenção.