

# Plano: Tornar explícitas as fontes disponíveis, eliminar dados simulados e integrar novas bases (IBGE Agregados, SNIS, Base dos Dados)

## 1. Problema

Atualmente o módulo DataSUS:
- Não deixa claro ao usuário quais dados pode realmente consultar
- Gera dados simulados quando não encontra dados reais (enganoso)
- Cobre apenas: arboviroses (InfoDengue), mortalidade/nascidos vivos (IBGE SIDRA), SRAG (OpenDataSUS), TB/hanseníase (TabNet)
- Não cruza dados entre bases diferentes

## 2. O que muda

### 2a. Eliminar dados simulados
- Quando o roteador retornar `null`, em vez de gerar código Python com dados inventados, retornar uma mensagem clara: *"Esta informação não está disponível nas fontes integradas ao sistema. As fontes disponíveis são: [lista]. Reformule sua pergunta ou consulte diretamente o TabNet."*
- Remover o `SIMULATED_PROMPT` e toda lógica de fallback para simulação
- Na UI, remover o indicador "Dados Simulados" (só existirão dados reais)

### 2b. Painel "Fontes Disponíveis" na UI
- Adicionar seção no estado vazio (antes de enviar a primeira mensagem) listando as fontes e o que cada uma cobre, com exemplos de perguntas válidas
- Organizar por categoria:

```text
┌────────────────────────────────────────────────┐
│  Fontes de dados disponíveis                   │
│                                                │
│  🦟 Arboviroses (Dengue, Zika, Chikungunya)   │
│     Fonte: InfoDengue · 2014-2024              │
│                                                │
│  💀 Mortalidade por causa (CID-10)             │
│     Fonte: IBGE SIDRA (SIM) · 2012-2022        │
│                                                │
│  👶 Nascidos vivos                              │
│     Fonte: IBGE SIDRA (SINASC) · 2012-2022     │
│                                                │
│  🫁 SRAG / COVID / Influenza                   │
│     Fonte: OpenDataSUS · 2020-2025             │
│                                                │
│  🦠 Tuberculose / Hanseníase (notificações)    │
│     Fonte: TabNet/SINAN · 2012-2023            │
│                                                │
│  📊 População, PIB, IDH (NOVO)                 │
│     Fonte: IBGE Agregados · 1991-2024          │
│                                                │
│  🚰 Saneamento básico (NOVO)                   │
│     Fonte: Base dos Dados/SNIS · 1995-2022     │
└────────────────────────────────────────────────┘
```

### 2c. Integrar novas fontes para cruzamento

#### IBGE API Agregados (servicodados.ibge.gov.br)
- **Endpoint**: `https://servicodados.ibge.gov.br/api/v3/agregados/{tabela}/periodos/{p}/variaveis/{v}?localidades=N3[{ufs}]`
- **Sem autenticação**, JSON puro, sem scraping
- **Tabelas úteis**:
  - 6579: População residente estimada por UF/ano
  - 5938: PIB per capita por UF
  - 4714: IDH por UF (PNUD via IBGE)
- **Uso**: normalizar indicadores de saúde por 100 mil hab, cruzar mortalidade com PIB, etc.

#### SNIS via Base dos Dados (BigQuery público)
- O SNIS não tem API REST. Os dados estão disponíveis via **Base dos Dados** (basedosdados.org) que expõe datasets do SNIS em BigQuery público.
- **Alternativa mais simples**: CSV estático hospedado no próprio Supabase Storage (upload manual de tabelas resumidas SNIS por UF/ano para água, esgoto, resíduos).
- **Uso**: cruzar cobertura de saneamento com incidência de doenças de veiculação hídrica.

## 3. Implementação

### Arquivo 1: `supabase/functions/datasus-query/index.ts`

**Alterações:**
1. Adicionar `fetchIBGEAgregados(tableId, variableId, stateCodes, startYear, endYear)` — fetcher genérico para API Agregados do IBGE (população, PIB, IDH)
2. Expandir `DataTopic` com `"population"`, `"demographics"`, `"sanitation"`
3. Expandir `detectTopic()` para detectar termos como "população", "PIB", "IDH", "saneamento", "água", "esgoto"
4. No roteador `fetchRealData`, adicionar rotas para population → IBGE Agregados, sanitation → CSV estático ou mensagem de indisponibilidade
5. **Eliminar fallback simulado**: quando `fetchRealData` retorna `null`, retornar resposta com `type: "unavailable"` em vez de gerar código com dados inventados
6. Adicionar lógica de **cruzamento**: quando o topic é mortalidade/arboviroses E população está disponível, buscar dados de população automaticamente e injetar ambos CSVs no prompt para cálculo de taxas por 100 mil hab
7. Remover `SIMULATED_PROMPT` completamente

**Nova resposta quando dados não disponíveis:**
```json
{
  "type": "unavailable",
  "explanation": "Esta consulta não pode ser respondida com as fontes atualmente integradas.",
  "available_sources": ["InfoDengue", "IBGE SIDRA", "OpenDataSUS", "TabNet/SINAN", "IBGE Agregados"],
  "suggestion": "Tente reformular usando um dos temas disponíveis: arboviroses, mortalidade, nascidos vivos, SRAG/COVID, tuberculose, hanseníase, população ou PIB."
}
```

### Arquivo 2: `src/pages/DataSUS.tsx`

**Alterações:**
1. Tratar resposta `type: "unavailable"` — exibir mensagem amigável em vez de erro
2. No estado vazio (sem mensagens), renderizar o painel "Fontes Disponíveis" com lista categorizada
3. Remover referências visuais a "dados simulados"

### Arquivo 3: `src/components/datasus/DataSUSResults.tsx`

**Alterações:**
1. Remover lógica condicional de "Dados simulados" (badge âmbar) — só exibe dados reais
2. Adicionar badge "IBGE Agregados" (índigo) no mapeamento de cores
3. Simplificar o rodapé de fonte

### Arquivo 4: `src/lib/datasus-catalog.ts`

**Alterações:**
1. Adicionar novas tabelas ao catálogo: IBGE Agregados (população, PIB)
2. Atualizar `EXAMPLE_QUERIES` com exemplos de cruzamento: "Taxa de mortalidade por 100 mil habitantes no Sudeste 2015-2022", "Relação entre PIB per capita e casos de dengue por UF"
3. Atualizar `DATASUS_SYSTEM_PROMPT` removendo menção a dados simulados e adicionando as novas fontes

### Arquivo 5: Novo componente `src/components/datasus/DataSUSSourcesPanel.tsx`

- Componente read-only que lista as fontes integradas com nome, cobertura temporal, tipo de dado e exemplos
- Usado no estado vazio da página DataSUS

## 4. Lógica de cruzamento automático

Quando o prompt do usuário menciona "taxa", "per capita", "por 100 mil" ou cruza temas (ex: "dengue vs PIB"), o sistema:
1. Busca dados do tema principal (ex: mortalidade via SIDRA)
2. Busca dados de população via IBGE Agregados automaticamente
3. Injeta ambos CSVs no prompt Python com instrução para fazer merge por UF/ano e calcular a taxa

## 5. Arquivos editados
1. `supabase/functions/datasus-query/index.ts` — novo fetcher IBGE Agregados, eliminar simulação, cruzamento
2. `src/pages/DataSUS.tsx` — tratar `unavailable`, painel de fontes
3. `src/components/datasus/DataSUSResults.tsx` — remover simulado, novo badge
4. `src/lib/datasus-catalog.ts` — novas fontes e exemplos
5. `src/components/datasus/DataSUSSourcesPanel.tsx` — novo componente

