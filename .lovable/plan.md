

# Plano: Integrar OpenDataSUS ao módulo DataSUS

## Problema
Atualmente, para TB e hanseníase, usamos apenas dados de **mortalidade** do IBGE SIDRA como proxy. O usuário quer dados de **notificação** (casos) reais, não só óbitos.

## Abordagem viável

O OpenDataSUS disponibiliza endpoints Elasticsearch públicos para alguns datasets. O mais acessível e útil é o de **SRAG (Síndrome Respiratória Aguda Grave)**, que inclui COVID-19 e Influenza. Para TB e hanseníase, não há API REST leve pública — mas podemos usar o **TabNet do DataSUS via POST request** (scraping leve), que é como os próprios pesquisadores acessam esses dados.

### Fontes a adicionar

| Tópico | Endpoint | Método |
|---|---|---|
| SRAG / COVID / Influenza | `elasticsearch-saps.saude.gov.br` | Elasticsearch query |
| TB (notificações) | TabNet SINAN | POST scraping |
| Hanseníase (notificações) | TabNet SINAN | POST scraping |

## Implementação

### 1. Fetcher OpenDataSUS SRAG (backend)
**Arquivo:** `supabase/functions/datasus-query/index.ts`

- Criar `fetchOpenDataSUSSRAG(stateCodes, startYear, endYear)`.
- Consultar `https://elasticsearch-saps.saude.gov.br/desc-srag-2021-2025/_search` com aggregation por UF e ano.
- Converter resultado em CSV: `ano,uf,casos_srag,obitos_srag`.
- Timeout 15s, fallback para simulado se falhar.

### 2. Fetcher TabNet SINAN (backend)
**Arquivo:** `supabase/functions/datasus-query/index.ts`

- Criar `fetchTabNetSINAN(disease, stateCodes, startYear, endYear)`.
- Enviar POST para `http://tabnet.datasus.gov.br/cgi/tabcgi.exe` com os parâmetros corretos do .def file (já temos no catálogo: `tubercbrn.def`, `hansbrn.def`).
- Parsear o HTML de retorno (tabela simples) para extrair dados tabulares.
- Converter para CSV normalizado.
- Fallback: manter SIDRA mortalidade se TabNet não responder.

### 3. Expandir roteador de fontes
- `covid|srag|influenza|gripe` → OpenDataSUS Elasticsearch
- `tuberculose|tb` → TabNet SINAN (notificações), fallback SIDRA (mortalidade)
- `hanseniase|hansen` → TabNet SINAN (notificações), fallback SIDRA (mortalidade)

### 4. Atualizar topic detection
Adicionar `"srag"` e `"covid"` como novos `DataTopic` values no `detectTopic()`.

### 5. Atualizar UI
**Arquivo:** `src/components/datasus/DataSUSResults.tsx`
- Adicionar badges "OpenDataSUS" (violet) e "TabNet/SINAN" (blue) ao sourceLabel.

### 6. Atualizar catálogo de exemplos
**Arquivo:** `src/lib/datasus-catalog.ts`
- Adicionar: "Casos de SRAG no Brasil em 2023", "Notificações de tuberculose no Nordeste 2015-2023".

## Riscos e mitigações

- **TabNet instável**: timeout frequente. Mitigação: retry 1x, fallback para SIDRA mortalidade.
- **Elasticsearch SRAG pode exigir credenciais**: testaremos primeiro; se falhar, usamos dados simulados com aviso claro.
- **HTML parsing do TabNet**: a estrutura é simples (tabela HTML), mas pode mudar. Parsing defensivo com fallback.

## Arquivos editados
1. `supabase/functions/datasus-query/index.ts` — novos fetchers + roteador expandido
2. `src/components/datasus/DataSUSResults.tsx` — badges de fonte
3. `src/lib/datasus-catalog.ts` — exemplos atualizados

