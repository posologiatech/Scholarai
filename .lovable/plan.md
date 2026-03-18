

## Novas bases de dados acadêmicas para o sistema de busca

### Situação atual
O sistema já integra **5 fontes** (Semantic Scholar, PubMed, OpenAlex, ClinicalTrials.gov, Europe PMC), mas na UI de loading só exibe 4 badges. Existem diversas APIs acadêmicas gratuitas que podem ser adicionadas para aumentar cobertura.

### Bases recomendadas para adicionar

| Base | Cobertura | API gratuita | Diferencial |
|------|-----------|-------------|-------------|
| **CrossRef** | 150M+ registros DOI | Sim | Maior banco de DOIs do mundo, metadados de citações |
| **CORE** | 300M+ papers open access | Sim (com API key gratuita) | Maior coleção de textos completos open access |
| **DOAJ** | 10M+ artigos | Sim | Foco em periódicos open access de qualidade |
| **Scopus** | 92M+ registros | Não (paga) | Premium, requer licença institucional |
| **IEEE Xplore** | 6M+ docs | Parcialmente | Engenharia e computação |

**Recomendação**: Adicionar **CrossRef** e **CORE** — ambas gratuitas, com APIs robustas e cobertura complementar ao que já existe.

### Alterações técnicas

**1. Edge Function `supabase/functions/search-papers/index.ts`**
- Adicionar funções `searchCrossRef()` e `searchCORE()` seguindo o mesmo padrão das existentes
- CrossRef API: `https://api.crossref.org/works?query=...` (sem chave)
- CORE API: `https://api.core.ac.uk/v3/search/works?q=...` (requer API key gratuita)
- Registrar ambas no `sourceMap`
- Adicionar `'crossref' | 'core'` ao tipo `SourceType`
- Incluir nos sources default

**2. Frontend `src/pages/SearchResults.tsx`**
- Atualizar o tipo `Paper.source` para incluir `'crossref' | 'core'`
- Adicionar badges/labels de fonte para CrossRef e CORE na tabela de resultados
- Atualizar a tela de loading para exibir as 6 bases (incluindo ClinicalTrials.gov que já existe mas não aparece no loading)

**3. Documentação e Oracle**
- Atualizar o system prompt do Oracle (`oracle-chat`) para mencionar as novas bases
- Atualizar a página de Docs com as novas fontes

**4. Secret para CORE (se incluído)**
- A API do CORE requer uma API key gratuita (registro em core.ac.uk)
- Armazenar como secret `CORE_API_KEY` nas Edge Functions

### Estimativa
- CrossRef: ~80 linhas de código (sem dependências externas)
- CORE: ~80 linhas + configuração de API key
- Ajustes de UI: ~20 linhas

