

# Plano: Integrar IBGE SIDRA + OpenDataSUS CSV ao DataSUS/SINAN

## Contexto

Atualmente o módulo DataSUS só obtém dados reais para arboviroses (Dengue, Chikungunya, Zika) via InfoDengue. Para qualquer outra doença/tópico (tuberculose, mortalidade, nascidos vivos, internações), o sistema gera dados simulados. Vamos integrar duas novas fontes para cobrir esses casos.

## Fontes a integrar

1. **IBGE SIDRA API** (sem autenticação) -- Mortalidade por causa (CID-10), nascidos vivos, estatísticas vitais
2. **OpenDataSUS CSV/Parquet** (sem autenticação) -- Dados brutos de SINAN (tuberculose, hanseníase, etc.), SIM, SINASC via download público

## Arquitetura

O fluxo existente na edge function `datasus-query` já segue:
1. AI extrai parâmetros (doença, local, período)
2. Tenta buscar dados reais (hoje só InfoDengue)
3. Gera código Python com dados reais ou simulados

A mudança é expandir o passo 2 com um roteador que tenta a fonte mais adequada.

```text
Consulta do usuário
       │
   AI extrai parâmetros
       │
   ┌───▼───────────────────┐
   │   Roteador de fontes  │
   │                       │
   │  arboviroses? ──► InfoDengue (existente)
   │  mortalidade?  ──► IBGE SIDRA (tabela 2681)
   │  nascimentos?  ──► IBGE SIDRA (tabela 2612)
   │  tuberculose?  ──► OpenDataSUS CSV
   │  hanseníase?   ──► OpenDataSUS CSV
   │  internações?  ──► fallback simulado
   └───────────────────────┘
       │
   Gera código Python com dados reais injetados
```

## Implementação

### 1. Adicionar fetcher IBGE SIDRA (backend)
**Arquivo:** `supabase/functions/datasus-query/index.ts`

- Criar função `fetchIBGESidra(topic, stateCodes, startYear, endYear)`.
- Para mortalidade: consultar tabela 2681 (óbitos por causa, UF, ano). URL: `https://apisidra.ibge.gov.br/values/t/2681/n3/{uf}/p/{anos}/v/allxp/c2/all`.
- Para nascidos vivos: tabela 2612.
- Parsear o JSON de retorno (SIDRA retorna array de objetos com campos "D1N", "D2N", "V" etc.) e converter para CSV normalizado.
- Timeout de 15s, retry uma vez em caso de falha.

### 2. Adicionar fetcher OpenDataSUS (backend)
**Arquivo:** `supabase/functions/datasus-query/index.ts`

- Criar função `fetchOpenDataSUS(disease, stateCodes, startYear, endYear)`.
- Para tuberculose: usar endpoint Elasticsearch do OpenDataSUS `https://elasticsearch-saps.saude.gov.br/desc-esus-notifica-estado-*/_search` com filtros por CID e período. Fallback: CSV público via URL fixa `https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/...`.
- Como o Elasticsearch pode requerer credenciais, priorizar a abordagem de CSV pré-processado: baixar arquivo CSV resumido (agregado por UF/ano) de URLs públicas conhecidas e parsear no edge function.
- Se nenhum CSV público estiver acessível em tempo de execução, usar IBGE SIDRA como proxy (tabela de mortalidade por tuberculose via CID A15-A19).

### 3. Criar roteador de fontes (backend)
**Arquivo:** `supabase/functions/datasus-query/index.ts`

- Criar função `fetchRealData(disease, location, period)` que decide qual fetcher chamar com base no tópico:
  - `dengue|chikungunya|zika` → InfoDengue (existente)
  - `mortalidade|obito|morte` → IBGE SIDRA tabela 2681
  - `nascimento|nascido|sinasc|natalidade` → IBGE SIDRA tabela 2612
  - `tuberculose|tb` → OpenDataSUS ou IBGE SIDRA (mortalidade TB)
  - `hanseniase|lepra` → OpenDataSUS ou fallback simulado
- Retorna `{ csv, rowCount, source }` ou `null`.

### 4. Adaptar prompt de análise para novas colunas (backend)
**Arquivo:** `supabase/functions/datasus-query/index.ts`

- A função `buildAnalysisPrompt` hoje descreve colunas fixas de InfoDengue. Torná-la dinâmica: receber descrição de colunas junto com o CSV.
- Cada fetcher retornará também `columnsDescription: string` com as colunas e seus significados.

### 5. Atualizar UI com novas fontes (frontend)
**Arquivo:** `src/components/datasus/DataSUSResults.tsx`

- Expandir o badge de fonte para mostrar "IBGE SIDRA" ou "OpenDataSUS" além de "InfoDengue".
- Manter a mesma lógica verde/âmbar (real vs. simulado).

### 6. Atualizar catálogo de exemplos
**Arquivo:** `src/lib/datasus-catalog.ts`

- Adicionar exemplos de consultas que agora retornarão dados reais (mortalidade, nascimentos, TB).

## Detalhes técnicos

**IBGE SIDRA API -- formato de resposta:**
```json
[
  {"D1C":"35","D1N":"São Paulo","D2C":"2020","D2N":"2020","V":"12345"},
  ...
]
```
O primeiro elemento é o header. Precisa ser tratado como metadado e ignorado na conversão CSV.

**Limites e robustez:**
- SIDRA tem limite de ~100 células por request; para consultas nacionais, iterar por UF.
- Timeout de 15s por request, com `AbortSignal.timeout`.
- Logs de métricas: fonte usada, rows retornados, tempo de fetch.

**Sem segredos adicionais** -- ambas as APIs são públicas e não requerem autenticação.

## Validação
- Testar consulta "Mortalidade por doenças cardiovasculares em SP 2018-2022" → deve retornar dados IBGE SIDRA reais.
- Testar consulta "Casos de tuberculose no Nordeste 2015-2023" → deve tentar OpenDataSUS/SIDRA.
- Testar consulta existente "Casos de dengue em SP" → deve continuar usando InfoDengue.
- Verificar badge correto na UI (fonte + real/simulado).

