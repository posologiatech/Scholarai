

# Plano: Arquitetura RAG para Extração Inteligente de Dados

## Contexto

Atualmente, a extração de colunas envia apenas abstracts para a IA, sem cache, sem embeddings e sem suporte a texto completo de PDFs. Isso limita a qualidade das respostas e gera custos desnecessarios com chamadas repetidas.

## Arquitetura Proposta (Adaptada ao Supabase)

```text
+------------------+     +-------------------+     +------------------+
|   Frontend       |     |  Edge Functions   |     |  Supabase DB     |
|  (React)         |---->|  extract-column   |---->|  PostgreSQL      |
|                  |     |  search-papers    |     |  + pgvector      |
|  Tabela com      |     |  embed-papers     |     |                  |
|  colunas         |     +-------------------+     |  paper_chunks    |
|  dinamicas       |            |                  |  extraction_cache|
+------------------+            v                  +------------------+
                         Gemini AI Gateway
```

Como o projeto usa Supabase (PostgreSQL), usaremos **pgvector** como banco vetorial nativo, eliminando a necessidade de Pinecone/Weaviate. O cache de extracoes evita chamadas duplicadas a IA.

---

## Etapa 1: Banco de Dados - Novas Tabelas

### 1.1 Habilitar pgvector + Tabela `paper_chunks`

Armazena o texto de artigos dividido em pedacos (chunks) com seus embeddings vetoriais.

```sql
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE public.paper_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id TEXT NOT NULL,          -- ID do paper (semantic scholar, pubmed, etc)
  paper_title TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,    -- Ordem do chunk no texto
  chunk_text TEXT NOT NULL,         -- Texto do pedaco
  embedding vector(768),           -- Embedding do chunk (768 dims para Gemini)
  source TEXT,                      -- abstract, full_text
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX paper_chunks_embedding_idx
  ON public.paper_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX paper_chunks_paper_id_idx ON public.paper_chunks(paper_id);
```

### 1.2 Tabela `extraction_cache`

Cache de resultados ja extraidos para evitar chamadas duplicadas.

```sql
CREATE TABLE public.extraction_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id TEXT NOT NULL,
  column_name TEXT NOT NULL,
  column_prompt TEXT,
  extracted_value TEXT NOT NULL,
  citation_context TEXT,           -- Trecho original de onde veio a informacao
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(paper_id, column_name)
);
```

---

## Etapa 2: Edge Function - `embed-papers`

Nova edge function que processa papers em background:

1. Recebe lista de papers (abstracts ou texto completo)
2. Divide o texto em chunks de ~500 tokens
3. Gera embeddings via Gemini
4. Salva chunks + embeddings na tabela `paper_chunks`

Isso permite que buscas futuras e extracoes usem busca semantica nos chunks.

---

## Etapa 3: Melhorar `extract-column`

Reescrever a edge function de extracao com pipeline RAG:

1. **Verificar cache**: Antes de chamar a IA, verificar se ja existe resultado em `extraction_cache` para o par (paper_id, column_name)
2. **Busca semantica**: Se o paper tem chunks com embeddings, buscar os chunks mais relevantes para a pergunta da coluna usando similaridade vetorial
3. **Gerar extracao**: Enviar os chunks relevantes (nao so o abstract) para a IA extrair a resposta
4. **Salvar no cache**: Armazenar resultado + citacao de contexto em `extraction_cache`
5. **Retornar resultado**: Incluir o campo `citation_context` na resposta

---

## Etapa 4: Integrar no Frontend

### 4.1 Gerar embeddings apos busca

Em `SearchResults.tsx`, apos receber os papers da busca, disparar uma chamada em background para `embed-papers` processar os abstracts.

### 4.2 Exibir citacoes de contexto

Nas celulas da tabela, adicionar um tooltip ou expandir com o trecho original de onde a IA extraiu a informacao (campo `citation_context`), garantindo transparencia.

### 4.3 Indicador visual de cache

Mostrar um icone sutil quando o dado veio do cache (resposta instantanea) vs. extracao em tempo real.

---

## Etapa 5: Processamento de PDFs completos

Integrar com a aba Extracao existente:

- Quando um PDF e carregado e processado via `extract-pdf`, o texto extraido e automaticamente dividido em chunks e salvo em `paper_chunks` com embeddings
- Isso permite que colunas customizadas busquem informacoes no texto completo do PDF, nao apenas no abstract

---

## Resumo dos Arquivos

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar tabelas `paper_chunks` e `extraction_cache` + extensao pgvector |
| `supabase/functions/embed-papers/index.ts` | Nova edge function para chunking + embeddings |
| `supabase/functions/extract-column/index.ts` | Reescrever com cache + busca vetorial + citacoes |
| `supabase/config.toml` | Adicionar config da nova edge function |
| `src/pages/SearchResults.tsx` | Disparar embeddings em background + exibir citacoes |

## Limitacoes e Consideracoes

- O pgvector nativo do Supabase substitui Pinecone/Weaviate sem custo adicional
- O Elasticsearch para filtros exatos nao e necessario pois o PostgreSQL com indices ja atende os filtros atuais (ano, fonte, tipo de estudo)
- WebSockets para streaming nao sao implementados nesta fase; os resultados continuam sendo retornados via HTTP com loading indicators
- O sistema de filas (Celery/Redis) e substituido por chamadas assincronas paralelas nas edge functions, que ja atendem a escala atual

