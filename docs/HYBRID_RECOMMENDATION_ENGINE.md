# Venus Engine — Hybrid Recommendation Engine

## Objetivo
Permitir que o sistema combine peças do usuário com peças da loja para gerar recomendações mais inteligentes, úteis e com maior potencial de conversão.

---

## Princípio central
O sistema não deve recomendar apenas produtos da loja.

Ele deve:
- analisar o que o usuário já possui
- identificar lacunas
- sugerir combinações híbridas

---

## Entradas

### Dados do usuário
- onboarding completo
- análise de imagem
- preferências

### Guarda-roupa do usuário (opcional)
- fotos de peças
- categorias (calça, blusa, etc)
- cores
- estilo

### Dados da loja (B2B)
- catálogo de produtos
- categorias
- cores
- tags de estilo

---

## Lógica do sistema

1. Identificar o estilo dominante do usuário
2. Mapear peças que ele já possui
3. Identificar lacunas no estilo
4. Cruzar com catálogo da loja
5. Gerar combinações híbridas

---

## Tipos de recomendação

### 1. Look híbrido
- parte do usuário
- parte da loja

### 2. Look completo da loja
- usado quando o usuário não tem base suficiente

### 3. Upgrade de look
- melhorar algo que o usuário já usa

---

## Exemplo de saída

Look 1:
- sua calça preta
- sua camiseta branca
- blazer da loja
- relógio da loja

Explicação:
“Esse look eleva sua presença mantendo o conforto do que você já usa.”

---

## Objetivo estratégico

- aumentar taxa de conversão
- aumentar ticket médio
- reduzir indecisão do cliente
- aumentar percepção de valor da IA

---

## Regra de ouro
A IA deve sempre tentar usar algo do usuário antes de sugerir comprar tudo novo.