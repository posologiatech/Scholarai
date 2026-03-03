

# Redesign do Knowledge Graph no estilo Connected Papers

## Objetivo
Transformar o Knowledge Graph atual (que usa nós de tipos variados: paper, author, concept, method) em um layout visual inspirado no Connected Papers, com 3 paineis e foco exclusivo em papers como nós do grafo.

## Layout: 3 Paineis (como Connected Papers)

```text
+------------------+-------------------------+------------------+
|  PAINEL ESQUERDO |    PAINEL CENTRAL       | PAINEL DIREITO   |
|                  |                         |                  |
|  Lista de papers |   Grafo force-directed  |  Detalhes do     |
|  relacionados    |   apenas com papers     |  paper           |
|                  |                         |  selecionado     |
|  - Origin paper  |   Nós = papers          |                  |
|    (destacado)   |   Cor = ano publicação  |  - Titulo        |
|  - Paper 1       |   Tamanho = citações    |  - Autores       |
|  - Paper 2       |   Proximidade =         |  - Ano/Journal   |
|  - ...           |     similaridade        |  - Citações      |
|                  |                         |  - Abstract/TLDR |
|  Busca na lista  |   Linhas = similaridade |  - Open in DOI   |
|  Expand button   |                         |  - Save          |
|                  |   Barra de anos         |                  |
|  Prior works tab |   (timeline inferior)   |  Prior works     |
|  Derivative tab  |                         |  Derivative works|
+------------------+-------------------------+------------------+
```

## Mudancas principais

### 1. KnowledgeGraphView.tsx - Redesign completo
- Remover nós de autor/conceito/metodo do grafo visual (manter apenas papers)
- Cor dos nós baseada no **ano de publicação** (gradiente: claro=antigo, escuro=recente)
- Tamanho dos nós baseado no **numero de citações**
- Origin paper marcado com borda roxa especial
- Linhas entre nós representam similaridade (geradas pela IA)
- Ao selecionar um nó, destacar o caminho mais curto ate o origin paper
- Barra de timeline de anos na parte inferior do grafo

### 2. KnowledgeGraph.tsx - Layout de 3 paineis
- **Painel esquerdo (~250px):** Lista scrollable de papers com busca, origin paper destacado, tabs "Prior works" / "Derivative works"
- **Painel central (flex-1):** O grafo force-directed
- **Painel direito (~300px):** Detalhes do paper selecionado (titulo completo, autores, journal, ano, citações, abstract/TL;DR, links externos, botao Save)
- Clicar em um paper na lista esquerda centraliza o grafo naquele nó
- Clicar em um nó no grafo atualiza o painel direito

### 3. Edge Function - Ajustar para formato Connected Papers
- Gerar apenas nós do tipo "paper" com campo `similarity` entre 0-100
- Gerar edges com peso de similaridade (baseado em co-citation e bibliographic coupling)
- Retornar listas separadas de `priorWorks` e `derivativeWorks`
- Prior works: papers mais citados pelos papers do grafo
- Derivative works: papers que citam muitos papers do grafo

### 4. Funcionalidades Connected Papers
- **Busca por DOI ou titulo** (seed paper)
- **Prior Works tab:** Lista de trabalhos seminais ordenavel por titulo, autor, ano, citações
- **Derivative Works tab:** Surveys e trabalhos recentes que citam o corpus
- **Download/Export** da lista de papers (BibTeX)
- **Timeline bar** na base do grafo mostrando distribuição por ano
- **Path highlighting:** ao selecionar um nó, mostrar caminho ate o origin

## Arquivos modificados
1. `supabase/functions/generate-knowledge-graph/index.ts` - Novo prompt focado em similaridade entre papers
2. `src/components/knowledge-graph/KnowledgeGraphView.tsx` - Redesign completo do grafo (apenas papers, cor=ano, tamanho=citações)
3. `src/pages/KnowledgeGraph.tsx` - Layout 3 paineis com lista lateral, detalhes e tabs

## Detalhes visuais (inspirados no Connected Papers)
- Cor dos nós: gradiente de bege/amarelo claro (papers antigos) ate verde escuro (papers recentes)
- Origin paper: borda roxa/lilás destacada
- Hover: tooltip com titulo resumido
- Seleção: highlight do nó + caminho ate origin
- Lista lateral: cada paper mostra titulo truncado, primeiro autor, ano
- Painel direito: titulo completo, todos autores, journal, citações, TL;DR

