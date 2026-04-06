# Venus Engine / InovaCortex - Project State Canonical

- Status: canonical
- Finalidade: registrar o estado real do sistema, o que já está forte, o que ainda falta e a ordem correta das proximas frentes.
- Quando consultar: antes de abrir qualquer nova feature, antes de reabrir uma discussao estrategica e antes de iniciar uma nova janela de continuidade.
- Regra de precedencia: este documento orienta continuidade estrategica antes de abrir novas frentes. Se houver conflito entre intuicao de produto e este documento, este documento prevalece ate uma nova decisao formal.

## Como usar este documento
- Leia primeiro a visao geral para entender o sistema como ele realmente esta hoje.
- Use a secao "O que ja esta forte" para evitar reabrir areas ja consolidadas.
- Use a linha do tempo para contextualizar qualquer decisao nova.
- Use "O que ainda falta de verdade" para priorizar apenas o que ainda tem impacto real.
- Use "O que nao fazer agora" para evitar overengineering e dispersao.
- Use o roadmap 30/60/90 dias para transformar estrategia em sequencia executavel.

## 1. Visao Geral Do Estado Atual

Hoje o Venus Engine / InovaCortex ja nao e um prototipo solto. Ele virou um sistema com nucleo de operacao real, governanca minima e leitura executiva suficiente para comandar a operacao sem depender de interpretacao manual caotica.

O sistema hoje faz de verdade:
- mantem `lead` como entidade canonica unica
- opera um pipeline comercial minimo real: `new`, `engaged`, `qualified`, `offer_sent`, `closing`, `won`, `lost`
- registra follow-up, fechamento, ganho e perda de forma auditavel
- aplica enforcement por tenant e hard caps
- executa persistencia transacional com idempotencia
- coordena concorrencia com single-flight minimo
- emite sinais operacionais canonicos
- agrega esses sinais em leitura operacional
- transforma sinais em recomendacoes
- transforma o pipeline em leitura de valor operacional
- mede aging por estagio
- expõe agency command center com risco, prioridade, acao e drill-down

Isso esta acima de prototipo porque:
- o dominio central existe e e consistente
- as mutacoes criticas sao rastreaveis e protegidas
- a agency raiz ja serve como painel de comando
- o drill-down da org ja serve como console de operacao
- o sistema ja consegue orientar decisao, nao so mostrar dados

## 2. O Que Ja Esta Forte

### Dominio / Lead / CRM

O que foi resolvido:
- `lead` e a unica entidade canonica de operacao comercial
- o pipeline tem estados claros e terminais
- `closing` foi incorporado como ponte real antes de `won`
- follow-up e mudanca de estagio sao persistidos e auditaveis

O que esta funcional:
- criar lead
- atualizar status
- marcar oferta enviada
- marcar fechamento iniciado
- marcar ganho e perdido
- registrar follow-up
- manter historico operacional via eventos

O que nao precisa ser reaberto agora:
- novo CRM
- nova entidade paralela
- novo sistema de pedidos
- novo funil paralelo
- workflow de vendas mais complexo sem base adicional

### Governanca / Agency

O que foi resolvido:
- a agency raiz ja funciona como command center
- ela mostra risco comercial agregado
- ela mostra atrito operacional
- ela mostra recomendacao executiva
- ela mostra valor operacional
- ela mostra aging por estagio

O que esta funcional:
- leitura macro por org
- priorizacao de acao imediata
- drill-down para operacao detalhada
- visao executiva sem inflar o layout

O que nao precisa ser reaberto agora:
- dashboard gigante
- nova camada analitica paralela
- redesign estrutural da agency
- excesso de blocos que so aumentem ruido

### Confiabilidade / Transacoes / Idempotencia

O que foi resolvido:
- update critico de lead virou transacional
- persistencia de saved result e lead virou atomica
- idempotencia foi formalizada
- single-flight minimo foi implementado
- duplicacao por retry acidental foi reduzida de forma canonica
- reserva de processamento tem expiracao e recuperacao

O que esta funcional:
- prevencao de estado parcial
- prevencao de duplicacao de persistencia
- protecao contra concorrencia basica
- trilha auditavel do que foi bloqueado, concluido, falhou ou esperou

O que nao precisa ser reaberto agora:
- fila
- worker
- locking pesado
- Redis
- observabilidade enterprise
- reescrita da camada de persistencia

### Observabilidade / Sinais / Recomendacoes

O que foi resolvido:
- sinais operacionais canonicos passaram a existir
- reason codes foram padronizados
- timings minimos foram capturados
- agregacao operacional por janela foi criada
- recomendacoes operacionais deterministicas foram criadas

O que esta funcional:
- ver bloqueio
- ver conflito
- ver espera
- ver latencia
- ver motivo dominante
- ver acao sugerida
- ver onde o atrito se concentra

O que nao precisa ser reaberto agora:
- tracing distribuido pesado
- plataforma de observabilidade
- paineis complexos sem necessidade
- motor de recomendacao com IA
- regras vagas e genericas

### Valor Operacional / Aging / Pipeline

O que foi resolvido:
- a operacao agora mostra avanco e travamento, nao so risco
- existe leitura de valor operacional por org e na root
- existe aging por estagio com fonte temporal canonica
- o sistema aponta onde o pipeline envelhece

O que esta funcional:
- contar pipeline ativo
- contar oferta enviada, closing, won e lost
- identificar gargalo principal
- identificar aging por estagio
- identificar estagio mais envelhecido
- identificar leads envelhecidos e criticos

O que nao precisa ser reaberto agora:
- ROI financeiro inventado
- ticket medio presumido
- previsao de faturamento sem base
- analise historica pesada
- coorte complexa sem necessidade

## 3. Linha Do Tempo Dos Avancos

1. `a7b5068` - padronizou a semantica temporal da agency, criando base para leitura consistente de janelas.
2. `dab071f` - refinou a agency raiz como snapshot consolidado e command center.
3. `abdf24a` - introduziu a primeira camada de hard caps server-side.
4. `f186395` - expandiu hard caps para AI engine e WhatsApp handoff.
5. `44ce213` - aplicou enforcement operacional por estado da org.
6. `4290d18` - criou CRM operacional minimo com pipeline de lead.
7. `c31dd78` - tornou follow-up tracking canonico no lead.
8. `04f168a` - adicionou filtros operacionais e leitura de follow-up no drill-down.
9. `7321f49` - deu visao macro de risco comercial por org na agency raiz.
10. `e8a91e7` - adicionou atalhos operacionais da agency para drill-down filtrado.
11. `7a06bed` - criou o bloco de prioridade maxima com orgs criticas por leads vencidos.
12. `da456a6` - criou o bloco de sem follow-up urgente.
13. `5a29b7b` - fechou o ciclo comercial minimo com `offer_sent`, `won` e `lost` auditaveis.
14. Etapa de confiabilidade - transformou update de lead em transacao auditavel com RPC.
15. Etapa de persistencia - blindou `processAndPersistLead` com idempotencia, persistencia transacional e single-flight minimo.
16. Etapa de observabilidade - adicionou sinais operacionais, reason codes e timings.
17. Etapa de leitura executiva - criou agregacao operacional, recomendacoes, valor operacional e aging por estagio.

## 4. Estado Pos-Separacao Em Commits

A separacao final do worktree foi concluida em commits limpos e isolados. O repositorio ficou com o estado operacional organizado em clusters justificaveis por si so.

- `68b41ab` - pacote A de fechamento do ciclo: documento canônico, surface final de resultado e base de testes.
- `c4b0bd9` - IA / recommendation: enriquecimento de catalogo, normalizacao de resultado e ranking mais restrito.
- `1d8c731` - agency / governanca: summaries de valor, aging, friccao e leitura executiva por org.
- `9ed37c1` - confiabilidade / core: idempotencia, single-flight, observabilidade e mutacoes transacionais do lead.
- `0e5e398` - demo / prova / premium polish: home, proof page, DemoTour e asset visual alinhados ao tom premium.

Estado atual apos a separacao:
- worktree limpo
- clusters isolados em commits distintos
- sequencia pronta para PRs na ordem definida
- nenhuma mistura de escopo remanescente no estado final do repositorio

## 5. O Que Ainda Falta De Verdade

### Maturidade Sistemica

Ainda falta:
- suite de testes mais ampla e realista
- cobertura mais forte de regressao em fluxos criticos
- formalizacao de ambientes e segredos
- disciplina de deploy e migracao mais robusta
- observabilidade de execucao mais completa sem virar plataforma pesada

### Loop De Valor

Ainda falta:
- prova mais forte de conversao do pipeline em resultado comercial percebido
- leitura temporal mais fina do avanco por coorte
- sinal mais forte de quanto o sistema melhora a operacao ao longo do tempo
- ponte mais concreta entre avanco comercial e resultado de negocio

### Desejo / Mercado

Ainda falta:
- uma promessa de valor extremamente clara para lojista e operador
- percepcao imediata de "isso me faz ganhar tempo e vender melhor"
- consistencia emocional do produto, alem da consistencia tecnica
- prova rapida de que o sistema reduz atrito real

### Escala

Ainda falta:
- mais robustez de concorrencia e execucao distribuida
- cobertura maior de falha parcial e retry
- capacidade de auditoria e recuperacao mais forte
- automacoes leves, mas ainda nao executadas, para reduzir trabalho repetitivo

## 6. Prioridade Real

A ordem correta, olhando o estado atual e a separacao em commits, e:

1. Fechamento e publicacao das PRs ja separadas
- manter os clusters isolados
- publicar na ordem definida
- evitar reagrupamento desnecessario
- preservar o estado limpo do worktree e a narrativa de continuidade

2. Consolidacao e limpeza
- estabilizar o que ja foi feito
- reduzir deriva
- impedir regressao de arquitetura e produto
- fechar lacunas pequenas de confiabilidade e leitura

3. Prova de valor
- reforcar o loop de valor comercial
- tornar o ganho operacional mais visivel para o usuario
- provar que o sistema nao so organiza, mas melhora conversao e cadencia

4. Maturidade operacional
- fortalecer testes
- melhorar ambiente
- endurecer governanca de execucao
- expandir a confiabilidade sem inflar arquitetura

5. Ponte transacional mais concreta
- so depois de estabilizar o valor, evoluir para ponte operacional mais forte entre fechamento e acao real
- sem inventar pedido, checkout ou ERP antes da hora

6. Escala e automacao leve
- aplicar automacoes canonicas pequenas quando houver lastro suficiente
- evitar complexidade antecipada

## 7. O Que Nao Fazer Agora

Nao reabrir:
- ERP
- pedido completo
- checkout completo
- pagamento integrado
- billing financeiro complexo
- nova entidade paralela
- nova plataforma de observabilidade
- dashboard gigante
- sistema especialista com IA generica
- fila/workers sem necessidade real
- analises historicas pesadas sem demanda clara
- ownership fake
- arquitetura paralela de operacao

Isso seria overengineering ou distração neste estagio.

## 7. Riscos Reais

### Tecnicos
- regressao em fluxos criticos por mudancas paralelas
- duplicacao de logica entre dominio, agency e drill-down
- dependencia excessiva de snapshots em vez de series temporais reais
- crescimento de complexidade na leitura executiva

### Operacionais
- sinais bons demais em numero, mas ruins em clareza
- excesso de blocos na agency, gerando ruido
- interpretacoes erradas de aging e valor se a equipe nao seguir a leitura canonica

### Produto
- risco de o sistema parecer forte tecnicamente, mas ainda nao ser percebido como indispensavel pelo lojista
- risco de o valor ficar muito na organizacao interna e pouco no resultado de negocio

### Percepcao
- se o usuario nao enxergar ganho imediato, o sistema pode ser visto como "bonito e inteligente", mas nao decisivo
- se a promessa ficar ampla demais, o produto perde nitidez

## 8. Roadmap 30 / 60 / 90 Dias

### 30 Dias
- consolidar e documentar o estado atual como referencia canonica
- fechar eventuais inconsistencias de leitura ou nomenclatura
- reforcar testes de integracao nos fluxos criticos
- garantir que a agency continue sendo um painel de comando claro e nao um mosaico de metricas

Foco:
- confiabilidade
- legibilidade
- estabilidade
- reducao de risco de regressao

### 60 Dias
- aprofundar o loop de valor operacional
- melhorar prova de avanco comercial
- refinar leitura de aging e conversao
- fortalecer o entendimento de onde o sistema produz resultado real

Foco:
- valor percebido
- resultado operacional
- clareza para o operador
- menor atrito na execucao

### 90 Dias
- endurecer o sistema para escala sem perder simplicidade
- ampliar governanca e testes
- melhorar a capacidade de medir impacto real sem inventar metricas
- so entao avancar em pontes transacionais mais concretas, se houver demanda real

Foco:
- escala
- robustez
- previsibilidade
- capacidade de virar produto altamente confiavel

## 9. Criterios De Pronto

### Sistema Confiavel
- operacoes criticas nao quebram em silencio
- retries nao duplicam resultado
- concorrencia nao corrompe estado
- eventos sao auditaveis
- falhas sao visiveis e recuperaveis

### Sistema Desejavel
- o usuario entende o valor em poucos segundos
- a agency mostra clareza, nao ruido
- o drill-down mostra acao, nao so dado
- o produto ajuda a decidir o proximo passo

### Sistema Escalavel
- o dominio principal continua simples
- o core tolera mais volume sem virar caos
- mudancas pequenas nao geram regressao sistemica
- a leitura executiva se mantem consistente com crescimento

### Sistema Vendavel
- resolve dor real de forma clara
- reduz trabalho e atrito de forma percebida
- prova ganho operacional
- tem narrativa simples e convincente para quem compra
- inspira confianca de uso continuo

## Fechamento

O estado atual ja e forte porque existe um nucleo real, coerente e auditavel. O risco agora nao e falta de feature basica. O risco e perder clareza estrategica e comecar a adicionar complexidade antes da hora.

A proxima disciplina nao e construir mais. E preservar o que ja foi conquistado, consolidar a direcao e so entao expandir com intencao.
