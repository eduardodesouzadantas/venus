# Maison-Elite Showroom Audit
**Data:** 2026-04-25
**Dataset:** `data/archive/fashion-dataset/` (Myntra/Kaggle Fashion Dataset)
**Objetivo:** Auditar acervo local e propor lote showroom balanceado por slot — sem importar nada.

---

## 1. Validação do Dataset

| Recurso | Encontrado | Contagem |
|---|---|---|
| `styles.csv` | ✅ | 44.446 linhas (44.445 registros + header) |
| `images.csv` | ✅ | 44.446 linhas (44.445 registros + header) |
| `images/` | ✅ | 44.441 arquivos `.jpg` |
| `styles/` JSON | ✅ | 44.446 arquivos `.json` |

Discrepância: 5 imagens ausentes (IDs presentes no CSV sem `.jpg` correspondente).

---

## 2. Campos Disponíveis

### styles.csv
| Campo | Tipo | Notas |
|---|---|---|
| `id` | int | chave primária |
| `gender` | enum | Men / Women / Unisex / Boys / Girls |
| `masterCategory` | enum | Apparel / Accessories / Footwear / Personal Care / Free Items / Sporting Goods / Home |
| `subCategory` | text | 45 valores distintos |
| `articleType` | text | ~120 valores distintos |
| `baseColour` | text | ~46 valores distintos |
| `season` | enum | Summer / Fall / Winter / Spring |
| `year` | int | 2010–2016 (majoritariamente) |
| `usage` | enum | Casual / Sports / Ethnic / Formal / Smart Casual / Party / Travel / NA |
| `productDisplayName` | text | nome do produto |

### images.csv
| Campo | Tipo | Notas |
|---|---|---|
| `filename` | string | `{id}.jpg` |
| `link` | url | URL Myntra (CDN externo, não local) |

### styles/{id}.json — Campos Ricos
| Campo | Disponibilidade | Notas |
|---|---|---|
| `brandName` | ✅ | ex.: Puma, Adidas, Scullers |
| `ageGroup` | ✅ | ex.: Adults-Men, Kids-Girls |
| `price` | ✅ | preço original (INR) |
| `discountedPrice` | ✅ | preço com desconto |
| `articleAttributes` | ✅ | dict — Pattern, Fabric, Fit, etc. |
| `productDescriptors` | parcial | descrição longa (nem sempre presente) |
| `styleImages` | ✅ | URLs multi-resolução do CDN Myntra |
| `displayCategories` | ✅ | breadcrumb de categorias |
| `navigationId` | ✅ | id de navegação interno |

---

## 3. Distribuição por Gênero

| Gênero | Registros | % |
|---|---|---|
| Men | 22.165 | 49,8% |
| Women | 18.632 | 41,9% |
| Unisex | 2.164 | 4,9% |
| Boys | 830 | 1,9% |
| Girls | 655 | 1,5% |

---

## 4. Distribuição por Master Category

| Categoria | Registros | % |
|---|---|---|
| Apparel | 21.400 | 48,1% |
| Accessories | 11.289 | 25,4% |
| Footwear | 9.222 | 20,7% |
| Personal Care | 2.404 | 5,4% |
| Free Items | 105 | 0,2% |
| Sporting Goods | 25 | 0,1% |
| Home | 1 | <0,1% |

---

## 5. Distribuição por Usage/Ocasião

| Usage | Registros | % |
|---|---|---|
| Casual | 34.414 | 77,4% |
| Sports | 4.025 | 9,1% |
| Ethnic | 3.208 | 7,2% |
| Formal | 2.359 | 5,3% |
| NA | 316 | 0,7% |
| Smart Casual | 67 | 0,2% |
| Party | 29 | 0,1% |
| Travel | 26 | 0,1% |

---

## 6. Distribuição por Slot de Composição

### Definição de Slots
| Slot | Critério |
|---|---|
| `top` | Shirts, Tshirts, Tops, Kurtas, Kurtis, Tunics, Blouses, Polos (Topwear sem layer) |
| `bottom` | Jeans, Trousers, Shorts, Skirts, Leggings, Track Pants, Capris (Bottomwear) |
| `layer` | Jackets, Blazers, Coats, Waistcoats, Sweaters, Sweatshirts, Hoodies, Cardigans |
| `one_piece` | Dresses, Sarees, Apparel Sets, Jumpsuits |
| `shoes` | Todo masterCategory = Footwear |
| `accessory` | Watches, Bags, Wallets, Belts, Sunglasses, Jewellery, Caps, Ties, Scarves |
| `underwear_or_excluded` | Briefs, Trunks, Bras, Innerwear Vests, Socks, Nightdress, Night Suits, Loungewear |
| `beauty_or_excluded` | Personal Care: Deodorant, Perfume, Lipstick, Nail Polish, Skin Care, Hair |
| `unknown` | Free Items, Sporting Goods, itens sem classificação clara |

### Contagens por Slot

| Slot | Total | Men | Women | Unisex | Boys | Girls |
|---|---|---|---|---|---|---|
| `top` | 15.175 | 8.626 | 5.518 | 72 | 621 | 338 |
| `accessory` | 10.600 | 3.891 | 5.242 | 1.423 | 16 | 28 |
| `shoes` | 9.222 | 5.751 | 2.836 | 521 | 54 | 60 |
| `underwear_or_excluded` | 2.979 | 1.647 | 1.236 | 74 | 11 | 11 |
| `bottom` | 2.694 | 1.399 | 1.044 | 9 | 107 | 135 |
| `beauty_or_excluded` | 2.404 | 580 | 1.809 | 15 | — | — |
| `one_piece` | 919 | — | 833 | — | 6 | 80 |
| `layer` | 310 | 218 | 69 | 13 | 10 | — |
| `unknown` | 143 | 53 | 45 | 37 | 5 | 3 |

### Desequilíbrios Críticos

```
Tops:Bottoms ratio = 15.175 : 2.694 = 5,6x  ← CRÍTICO
Tops:Layers ratio  = 15.175 : 310   = 49x   ← CRÍTICO
```

O dataset está fortemente enviesado para tops e acessórios. Bottoms e layers são escassos.

---

## 7. Categorias Problemáticas

| Problema | Tipo | Registros | Impacto |
|---|---|---|---|
| Sarees (Étnico) | one_piece | 427 | Não se encaixa em look casual/formal ocidental |
| Sarees = 46% dos one_piece | viés étnico | — | Diluem dresses úteis para o showroom |
| Ties | accessory/unknown | 258 | Acessório formal masculino isolado, baixa versatilidade |
| Kids (Boys+Girls) | demographic | 1.485 | Fora do escopo maison-elite (adultos) |
| Free Items | junk | 105 | Sem valor de curadoria |
| Sports Equipment | off-category | 21 | Fora do escopo |
| Innerwear Vests | underwear | 242 | Excluídos de hero/curadoria |
| NA usage | ruído | 316 | Contexto de uso indefinido |
| Preços em INR (rúpia) | metadata | 100% | Valores precisam normalização antes de exibir |

---

## 8. Showroom Quality Score (0–100)

### Critérios

| Critério | Pontos |
|---|---|
| Imagem local presente | +20 |
| Nome limpo (5–100 chars) | +10 |
| Categoria completa (master + sub + articleType) | +10 |
| Slot útil para composição (top/bottom/layer/one_piece/shoes) | +25 |
| Slot accessory | +10 |
| Cor combinável (neutras + cores primárias) | +15 |
| Usage útil (Casual/Formal/Smart Casual/Sports/Party/Travel) | +10 |
| Gênero adulto (Men/Women) | +5 |
| Penalidade: slot underwear/beauty | −30 |
| Penalidade: slot unknown | −15 |
| Penalidade: Kids (Boys/Girls) | −10 |

### Distribuição de Scores

| Faixa | Registros |
|---|---|
| 90–100 | 17.848 (40,1%) |
| 80–89 | 14.113 (31,7%) |
| 70–79 | 2.922 (6,6%) |
| 60–69 | 3.843 (8,6%) |
| 40–59 | 3.526 (7,9%) |
| 0–39 | 2.194 (4,9%) |

**71.8% do acervo tem score ≥ 80** — dataset de boa qualidade geral.

---

## 9. Amostras: Itens Bons por Slot

### Top (score ≥ 95)
| ID | Nome | Gênero | Cor | Usage |
|---|---|---|---|---|
| 15970 | Turtle Check Men Navy Blue Shirt | Men | Navy Blue | Casual |
| 53759 | Puma Men Grey T-shirt | Men | Grey | Casual |
| 1855 | Inkfruit Mens Chain Reaction T-shirt | Men | Grey | Casual |

### Bottom (score ≥ 95)
| ID | Nome | Gênero | Cor | Usage |
|---|---|---|---|---|
| 39386 | Peter England Men Party Blue Jeans | Men | Blue | Casual |
| 21379 | Manchester United Men Solid Black Track Pants | Men | Black | Casual |
| 18005 | Puma Men Long Logo Black Bermuda | Men | Black | Sports |

### Layer (score ≥ 95)
| ID | Nome | Gênero | Cor | Usage |
|---|---|---|---|---|
| 13089 | ADIDAS Men Lfc Auth Hood Grey Sweatshirts | Men | Grey | Sports |
| 8580 | Scullers Men Grey Waistcoat | Men | Grey | Casual |
| 23876 | ADIDAS Men Blue Sweatshirt | Men | Blue | Casual |

### Shoes (score ≥ 95)
| ID | Nome | Gênero | Cor | Usage |
|---|---|---|---|---|
| 9204 | Puma Men Future Cat Remix SF Black Casual Shoes | Men | Black | Casual |
| 12967 | ADIDAS Men Spry M Black Sandals | Men | Black | Casual |
| 18653 | Fila Men Cush Flex Black Slippers | Men | Black | Casual |

### One-piece / Dress (score ≥ 95)
| ID | Nome | Gênero | Cor | Usage |
|---|---|---|---|---|
| 39716 | Arrow Woman Women Blue Dress | Women | Blue | Casual |
| 10406 | United Colors of Benetton Women Solid Grey Dresses | Women | Grey | Casual |
| 4988 | Gini and Jony Girl's Vanya White Polka Dot Kidswear | Women | White | Casual |

### Accessory (score ≥ 80)
| ID | Nome | Gênero | Cor | Usage |
|---|---|---|---|---|
| 30039 | Skagen Men Black Watch | Men | Black | Casual |
| 48123 | Fossil Women Black Huarache Weave Belt | Women | Black | Casual |
| 47957 | Murcia Women Blue Handbag | Women | Blue | Casual |

---

## 10. Amostras: Itens Excluídos

| ID | Nome | Slot | Motivo |
|---|---|---|---|
| 29114 | Puma Men Pack of 3 Socks | underwear_or_excluded | Socks — não aparece em look hero |
| 51832 | Bwitch Beige Full-Coverage Bra BW335 | underwear_or_excluded | Lingerie íntima — fora de hero |
| 32138 | Playboy Men Blue Titanium Briefs | underwear_or_excluded | Cueca — excluída de curadoria principal |
| 17885 | Levis Men Comfort Style Grey Innerwear Vest | underwear_or_excluded | Camiseta íntima — excluída |
| 18461 | David Beckham Signature Men Deos | beauty_or_excluded | Desodorante — Personal Care |
| 56019 | Colorbar Soft Touch Show Stopper Copper Lipstick 037 | beauty_or_excluded | Cosmético — fora do escopo de vestuário |

---

## 11. Proposta de Lote Showroom — 780 Itens

### Distribuição por Slot (score mínimo: 75)

| Slot | Gênero | Alvo | Disponível | Status |
|---|---|---|---|---|
| top | Men | 120 | 8.626 | ✅ amplo |
| bottom | Men | 80 | 1.399 | ✅ OK |
| layer | Men | 40 | 218 | ✅ OK |
| shoes | Men | 80 | 5.751 | ✅ amplo |
| accessory | Men | 50 | 3.891 | ✅ amplo |
| top | Women | 100 | 5.518 | ✅ amplo |
| bottom | Women | 60 | 1.044 | ✅ OK |
| one_piece | Women | 50 | 833 | ⚠️ limitado (46% sarees) |
| layer | Women | 30 | 69 | ⚠️ escasso |
| shoes | Women | 70 | 2.836 | ✅ amplo |
| accessory | Women | 50 | 5.242 | ✅ amplo |
| shoes | Unisex | 20 | 521 | ✅ OK |
| accessory | Unisex | 30 | 1.423 | ✅ amplo |
| **TOTAL** | — | **780** | — | Score médio: **92.2** |

### Score Stats do Lote
- Score mínimo: 75
- Score médio: 92.2
- Score máximo: 95

### Distribuição por Usage no Lote Proposto
Dada a dominância Casual (77.4%), o lote será predominantemente Casual, com representação de Formal e Sports nos layers e shoes masculinos.

---

## 12. Riscos

| Risco | Severidade | Descrição |
|---|---|---|
| Desbalanceamento tops:bottoms | 🔴 Alto | 5,6x mais tops que bottoms — composições incompletas |
| Escassez de layers femininos | 🔴 Alto | Apenas 69 itens Women\|layer no dataset inteiro |
| Viés étnico em one_piece | 🟡 Médio | 46% dos one_piece são sarees — requer filtro por `usage != Ethnic` |
| Kids misturados | 🟡 Médio | Boys+Girls têm 1.485 itens que vão infiltrar se não houver filtro de `ageGroup` |
| Preços em INR | 🟡 Médio | `price`/`discountedPrice` nos JSONs estão em rúpias indianas — não exibir sem conversão |
| CDN Myntra expirado | 🟡 Médio | URLs de imagem nos JSONs são do CDN Myntra — provavelmente inativas; usar imagens locais |
| Brands genéricas | 🟢 Baixo | Dataset inclui marcas massificadas (Puma, Adidas) — ok para pilot, mas não premium |
| Sazonalidade 2010–2016 | 🟢 Baixo | Anos antigos; não exibir field `year` diretamente ao usuário |

---

## 13. Próximo Passo Operacional

Após aprovação deste audit, o fluxo recomendado de import showroom é:

1. **Filtrar lote**: aplicar script de seleção com critérios do score ≥ 75 + filtros de slot + `gender IN ('Men','Women','Unisex')` + `usage != 'Ethnic'` para one_piece
2. **Enriquecer via JSON**: para cada item do lote, ler `styles/{id}.json` e extrair `brandName`, `articleAttributes`, `ageGroup`
3. **Resolver imagem local**: confirmar que `images/{id}.jpg` existe antes do import
4. **Gerar CSV de import**: produzir arquivo `data/showroom-batch-maison-elite.csv` com campos normalizados para o catálogo Venus
5. **Review humano**: validar amostra de 50 itens antes de `import confirm`
6. **Import com tenant**: rodar script de import com `--tenant=maison-elite --dry-run` primeiro

---

## 14. Checklist Final

| Item | Status |
|---|---|
| Dataset encontrado | ✅ |
| styles.csv: 44.445 linhas | ✅ |
| images.csv: 44.445 linhas | ✅ |
| images/: 44.441 arquivos | ✅ |
| styles/ JSON: 44.446 arquivos | ✅ |
| Campos mapeados (CSV + JSON) | ✅ |
| Slots classificados | ✅ |
| Contagens por slot/gender/usage | ✅ |
| Itens proibidos identificados | ✅ |
| Quality score definido | ✅ |
| Lote showroom proposto (780 itens) | ✅ |
| Banco não alterado | ✅ |
| Import não executado | ✅ |
| .gitignore verificado/ajustado | ✅ |
| Pronto para próximo passo | ✅ |
