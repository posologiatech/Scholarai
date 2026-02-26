

# Plano: Revisão Sistemática no ScholarAI

## Visao Geral

Implementar um fluxo de trabalho de revisao sistematica inspirado no Elicit, iniciando a partir da tela de pesquisa (Dashboard). Quando o usuario marcar a opcao "Preencher etapas com sugestoes baseadas na pergunta de pesquisa", ao submeter a busca ele sera direcionado para um fluxo guiado com as etapas: Coleta de Artigos, Triagem, Extracao de Dados e Relatorio.

---

## Fluxo do Usuario

1. **Dashboard** - Campo de pesquisa ganha um checkbox "Preencher etapas com sugestoes baseadas na pergunta de pesquisa" (similar a imagem do Elicit)
2. Se marcado, ao submeter a busca o usuario vai para `/systematic-review` em vez de `/search`
3. A pagina de revisao sistematica tem um **stepper** com 5 etapas:
   - **Pergunta de Pesquisa** (ja preenchida, com avaliacao de qualidade)
   - **Coleta de Artigos** (busca semantica + upload de PDFs da biblioteca)
   - **Criterios de Triagem** (definir e aplicar criterios de inclusao/exclusao)
   - **Extracao de Dados** (definir campos e extrair de artigos selecionados)
   - **Relatorio** (gerar sintese final)

---

## Etapas de Implementacao

### Fase 1: UI do Dashboard (checkbox)

- Adicionar checkbox com label "Preencher etapas com sugestoes baseadas na pergunta de pesquisa" no componente `Dashboard.tsx`, dentro do card de busca, entre o `QuestionEvaluator` e a barra inferior
- Estado booleano `systematicReview` controlando se o fluxo vai para `/search` ou `/systematic-review`

### Fase 2: Tabela no Supabase

Criar tabela `systematic_reviews` com:
- `id` (UUID, PK)
- `user_id` (UUID, FK auth.users)
- `research_question` (text)
- `status` (text: draft, screening, extracting, complete)
- `papers` (JSONB - artigos coletados)
- `screening_criteria` (JSONB - criterios de triagem)
- `screening_results` (JSONB - resultados da triagem por artigo)
- `extraction_columns` (JSONB - campos de extracao)
- `extraction_results` (JSONB - dados extraidos)
- `included_paper_ids` (text[] - IDs dos artigos incluidos)
- `created_at`, `updated_at`
- RLS: usuario so acessa os proprios registros

### Fase 3: Pagina `/systematic-review` 

Criar `src/pages/SystematicReview.tsx` com:
- Stepper visual (5 etapas) no topo
- Navegacao entre etapas com botoes Anterior/Proximo
- Persistencia automatica no Supabase a cada alteracao

**Etapa 1 - Pergunta de Pesquisa:**
- Exibe a pergunta ja preenchida com o `QuestionEvaluator`
- Permite editar antes de prosseguir

**Etapa 2 - Coleta de Artigos:**
- Busca semantica automatica (reutiliza `search-papers` edge function) com ate 500 resultados
- Opcao de adicionar artigos da biblioteca existente
- Upload de PDFs adicionais
- Lista todos os artigos coletados com titulo/autores/ano

**Etapa 3 - Criterios de Triagem:**
- Edge function `generate-screening-criteria` que recebe a pergunta e sugere 5-8 criterios automaticamente (ex: populacao, intervencao, desfecho, desenho do estudo)
- Cada criterio e editavel, pode ser ativado/desativado
- Executa triagem em amostra de ~50 artigos primeiro para iteracao rapida
- Cada artigo recebe Sim/Nao/Talvez por criterio, com explicacao
- Botao "Avaliar todos" executa nos artigos restantes
- Ranking por probabilidade de inclusao
- Override manual possivel

**Etapa 4 - Extracao de Dados:**
- Edge function `generate-extraction-fields` que sugere campos baseados na pergunta
- Reutiliza a logica existente de `extract-column` para extrair dados
- Tabela com artigos incluidos x campos de extracao
- Citacoes vinculadas ao texto original

**Etapa 5 - Relatorio:**
- Reutiliza a edge function `synthesize-papers` existente para gerar relatorio
- Inclui diagrama PRISMA (contagem de artigos em cada etapa)
- Exportacao em PDF

### Fase 4: Edge Functions novas

1. **`generate-screening-criteria`** - Recebe pergunta de pesquisa, retorna criterios de triagem sugeridos com descricoes
2. **`screen-papers`** - Recebe artigos + criterios, retorna avaliacao Sim/Nao/Talvez por criterio por artigo, com explicacao e score de inclusao

### Fase 5: Rota e Navegacao

- Adicionar rota `/systematic-review` e `/systematic-review/:id` em `App.tsx`
- Adicionar link "Revisoes Sistematicas" no menu de acoes rapidas do Dashboard
- Pagina de listagem de revisoes sistematicas salvas

---

## Detalhes Tecnicos

- **Componentes**: Sera criado um componente principal `SystematicReview.tsx` com sub-componentes para cada etapa (StepQuestion, StepCollection, StepScreening, StepExtraction, StepReport)
- **Estado**: Gerenciado localmente com `useState` e persistido no Supabase via debounce
- **Edge Functions**: Usam o modulo `ai-caller.ts` existente para priorizar chaves API configuradas
- **Streaming**: Triagem e extracao usam SSE para feedback em tempo real
- **Internacionalizacao**: Todas as strings suportam pt/en via `useLanguage`

---

## Ordem de Implementacao Sugerida

1. Checkbox no Dashboard + rota nova
2. Migracao do banco (tabela `systematic_reviews`)
3. Pagina com stepper e Etapa 1 (pergunta)
4. Etapa 2 (coleta de artigos)
5. Edge function `generate-screening-criteria` + Etapa 3
6. Edge function `screen-papers` + UI de triagem
7. Etapa 4 (extracao, reutilizando logica existente)
8. Etapa 5 (relatorio)

