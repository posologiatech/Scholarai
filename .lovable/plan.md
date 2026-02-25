

# Plano: Melhorias na Tabela e Prompt Anti-Alucinacao

## O que ja esta implementado (nao precisa mexer)

- **Estado por celula + SSE streaming**: Cada celula carrega independentemente com skeleton e os resultados chegam via Server-Sent Events em tempo real
- **Citacao clicavel**: O backend retorna `citation_context` e o frontend exibe via Popover ao clicar em "Fonte"
- **Redimensionamento de colunas**: Ja funciona com drag via mousedown/mousemove

## O que sera implementado

### 1. Virtualizacao da Tabela com @tanstack/react-virtual

**Problema**: Com 50+ papers e 5+ colunas, o DOM renderiza todas as linhas simultaneamente, podendo causar lentidao.

**Solucao**: Instalar `@tanstack/react-virtual` e aplicar virtualizacao de linhas na tabela existente.

**Arquivo**: `src/pages/SearchResults.tsx`

- Adicionar `useVirtualizer` do `@tanstack/react-virtual`
- Envolver o `<tbody>` em um container com altura fixa e overflow scroll
- Renderizar apenas as linhas visiveis (estimativa: ~15 linhas na viewport)
- Manter o comportamento atual de colunas, resize, filtros etc.
- O container tera `max-height: calc(100vh - 280px)` para ocupar o espaco disponivel

### 2. Migracao para TanStack Table

**Problema**: A logica de ordenacao, filtragem e estrutura da tabela e toda manual, dificultando adicionar funcionalidades como reordenacao de colunas por drag.

**Solucao**: Instalar `@tanstack/react-table` e migrar a tabela para usar o data grid padrao da industria.

**Arquivo**: `src/pages/SearchResults.tsx`

- Definir `columnDefs` usando `createColumnHelper` do TanStack Table
- A coluna "Paper" sera fixa (pinned left)
- Colunas dinamicas serao geradas a partir de `enabledColumns`
- Sorting nativo via `getSortedRowModel()` substituindo o `sorted` manual
- Column ordering para permitir arrastar colunas futuramente
- Manter o resize handler existente integrado com `columnSizing` do TanStack
- A virtualizacao do passo 1 se integra naturalmente com as rows do TanStack Table

### 3. Prompt Estruturado Anti-Alucinacao

**Problema**: O prompt atual pede citacao mas nao tem a regra explicita do "Nao mencionado" nem a restricao forte de usar apenas o texto fornecido.

**Solucao**: Atualizar o system prompt na Edge Function para incluir as regras anti-alucinacao.

**Arquivo**: `supabase/functions/extract-column/index.ts`

Mudancas no prompt (tanto versao PT quanto EN):

```text
[REGRAS]
1. Baseie sua resposta APENAS no texto fornecido. Nao use conhecimento externo.
2. Seja conciso (1-3 frases).
3. Se a informacao NAO estiver explicitamente no texto, retorne "Nao mencionado" 
   (ou "Not mentioned" em ingles). Jamais deduza ou invente.
4. Para cada resposta encontrada, extraia a frase EXATA do texto original 
   que comprova a resposta no campo citation_context.
```

- Atualizar o schema do Function Calling para incluir descricao mais restritiva nos campos
- Adicionar `"Nao mencionado"` / `"Not mentioned"` como valor explicito esperado

### 4. Tooltip de Citacao Aprimorado (Hover em vez de Click)

**Problema**: Atualmente a citacao so aparece ao clicar no botao "Fonte". O padrao Elicit mostra ao passar o mouse sobre a celula.

**Solucao**: Substituir o Popover por um `HoverCard` do Radix que aparece ao hover sobre o texto da celula.

**Arquivo**: `src/pages/SearchResults.tsx`

- Envolver o texto da celula com `<HoverCard>` + `<HoverCardTrigger>` + `<HoverCardContent>`
- O hover mostra a citacao exata em italico com destaque visual
- Manter o botao "Fonte" como fallback para mobile (onde hover nao funciona)

---

## Sequencia de implementacao

1. Instalar dependencias: `@tanstack/react-virtual` e `@tanstack/react-table`
2. Atualizar o prompt anti-alucinacao no `extract-column`
3. Migrar a tabela para TanStack Table com virtualizacao
4. Adicionar HoverCard nas celulas de citacao

## Riscos e mitigacoes

- **Migracao da tabela**: E a mudanca mais complexa. Sera feita preservando toda a logica existente de state (columnData, columnCitations, etc.) e apenas mudando a camada de renderizacao
- **Virtualizacao + resize**: O `@tanstack/react-virtual` precisa de alturas estimadas por linha. Como o conteudo e texto variavel, usaremos `estimateSize` com valor generoso (~120px) e `measureElement` para correcao automatica

