
## Problema

A extração retorna "Não mencionado" para a maioria dos campos porque:

1. **Papers não são incorporados (embedded)**: O fluxo de revisão sistemática nunca chama `embed-papers` antes da extração. A busca semântica (`match_paper_chunks`) não encontra nada, então a IA só vê o abstract.
2. **Abstracts curtos ou ausentes**: Muitos papers têm abstracts vagos que não contêm dados específicos como tamanho de amostra, tipo de estudo, etc.
3. **Prompt muito rigoroso**: O prompt atual exige que a informação esteja EXPLÍCITA no texto. Se não está, retorna "Não mencionado" -- mas para abstracts, quase nunca estará explícita.

## Solução

### 1. Incorporar (embed) os papers antes da extração

Adicionar uma etapa automática no `StepExtraction.tsx` que chama `embed-papers` para todos os artigos incluídos antes de executar a extração. Isso alimenta a tabela `paper_chunks` para que a busca semântica funcione.

### 2. Adaptar o prompt de extração para abstracts

Modificar o prompt em `extract-column/index.ts` para:
- Quando só houver abstract disponível, instruir a IA a **inferir** informações razoáveis do contexto do abstract em vez de exigir menção explícita
- Permitir respostas como "Ensaio clínico randomizado (inferido do abstract)" em vez de "Não mencionado"
- Manter "Não mencionado" apenas quando realmente não há NENHUMA pista no texto

### 3. Enriquecer o contexto enviado à IA

Modificar `buildPaperSummary` em `extract-column/index.ts` para incluir todos os metadados disponíveis (autores completos, journal, DOI, ano) no texto enviado à IA, pois esses dados podem ajudar a inferir tipo de estudo, população, etc.

## Detalhes Técnicos

### `src/components/app/systematic-review/StepExtraction.tsx`
- Adicionar função `embedPapers()` que chama `embed-papers` com os artigos incluídos
- Chamar `embedPapers()` automaticamente ao montar o componente (antes da extração) ou como primeiro passo do `runExtraction()`
- Mostrar indicador de progresso "Preparando artigos..." durante o embedding

### `supabase/functions/extract-column/index.ts`
- Alterar `buildSystemPrompt` para a extração factual: permitir inferência quando só abstract está disponível, distinguindo entre "extraído diretamente" e "inferido do contexto"
- Alterar `buildPaperSummary` para incluir metadados extras: journal, DOI, lista completa de autores
- Reduzir `match_threshold` de 0.3 para 0.2 na busca semântica para capturar mais contexto relevante
- Reimplantar a edge function após alterações
