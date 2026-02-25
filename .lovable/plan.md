

# Plano de Evolucao: Arquitetura Completa Inspirada no scite.ai

## O que JA ESTA implementado no seu sistema

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Classificador de Citacoes (Edge Function) | Implementado | `classify-citations` classifica em Supporting/Contrasting/Mentioning via IA |
| Tabela `citation_classifications` | Implementada | Campos paper_id, cited_paper_id, classification, citation_context, confidence |
| Badges de Citacao (CitationBadge) | Implementado | Componente com contagem colorida (verde/vermelho/cinza) nos resultados |
| Pagina de Relatorio do Artigo | Implementada | `/paper/:id` com graficos de pizza/barras e lista de contextos filtravelk |
| Verificador de Referencias | Implementado | Pagina + Edge Function com verificacao via CrossRef e IA |
| Assistente RAG (Chat) | Implementado | `chat-papers` com busca semantica em chunks + streaming |
| Extracao de Colunas com Citacoes | Implementada | Prompts restritivos, cache, busca semantica, citacoes exatas |
| Busca Multi-fonte | Implementada | Semantic Scholar, PubMed, OpenAlex, ClinicalTrials, Europe PMC |
| Traducao automatica de queries | Implementada | PT -> EN automatico para maximizar resultados |
| Upload de PDFs + Embeddings | Implementado | Fragmentacao em chunks + pgvector |
| Dashboard + Biblioteca | Implementados | Historico, pesquisas salvas, exportacao PDF |
| Autenticacao com aprovacao admin | Implementada | Tabela user_approvals com fluxo completo |

## O que PRECISA ser implementado/melhorado (6 melhorias)

### 1. Tabela dedicada de Papers (Entidade Artigo completa)

Atualmente os papers nao tem tabela propria — o sistema depende de `paper_chunks` para metadados. A arquitetura descrita exige uma entidade Artigo robusta com contadores em cache.

**Nova tabela `papers`:**
- id (UUID), doi (UNIQUE), title, authors (JSONB), year, journal, abstract, source, url, open_access
- Contadores em cache: total_citations_received, total_supporting, total_contrasting, total_mentioning
- created_at, updated_at

**Impacto:** O CitationBadge deixara de consultar `citation_classifications` a cada render e usara os contadores pre-calculados (performance dramaticamente melhor).

### 2. Campo `section` na tabela citation_classifications

A arquitetura descreve que cada citacao deve registrar em qual secao do paper ela ocorre (Introducao, Metodologia, Resultados, Discussao). Isso e crucial para pesquisadores saberem se um paper foi citado "de passagem" na introducao ou criticamente na discussao.

**Alteracao:** Adicionar coluna `section` (TEXT) a `citation_classifications` e atualizar a Edge Function `classify-citations` para extrair a secao do texto.

### 3. Prompt Anti-Alucinacao Reforçado no Chat (chat-papers)

O prompt atual do assistente e funcional mas nao segue a engenharia rigorosa descrita. Melhorias:

- Regras com "PENA DE FALHA" em caixa alta
- Rota de fuga explicita ("Nao encontrei evidencias suficientes...")
- Mapeamento estrito de IDs [1], [2] com proibicao de inventar fontes
- Injecao do campo "Classificacao scite" (Apoio/Contraste) dentro do contexto de cada paper
- Regra explicita para mencionar conflitos na literatura

### 4. Validacao de Citacoes no Backend (Pos-Processamento)

Implementar a "Guarda Pretoriana" descrita: apos a IA gerar a resposta no chat, o backend deve:

1. Extrair todos os padroes `[N]` da resposta via Regex
2. Verificar se cada N existe nos contextos fornecidos
3. Remover frases com IDs inventados OU solicitar re-geracao
4. Retornar a resposta limpa ao usuario

Isso reduz alucinacoes a praticamente zero.

### 5. Trigger para atualizar contadores em cache

Criar um trigger PostgreSQL que, ao inserir/deletar em `citation_classifications`, atualiza automaticamente os contadores `total_supporting`, `total_contrasting`, `total_mentioning` na tabela `papers`.

### 6. Pipeline de Ingestao Automatica de Papers

Atualizar o fluxo de busca (`search-papers`) para que, ao encontrar papers novos, eles sejam automaticamente salvos na tabela `papers` (com deduplicacao por DOI). Isso constroi o banco de dados de artigos de forma incremental conforme os usuarios pesquisam.

## Detalhamento Tecnico

### Migracao SQL (1 migracao)

```text
1. Criar tabela 'papers' com todos os campos + contadores
2. Adicionar coluna 'section' em citation_classifications
3. Criar trigger para atualizar contadores automaticamente
4. Popular tabela papers a partir dos paper_chunks existentes
5. RLS policies para leitura publica e escrita via service_role
```

### Arquivos a modificar

| Arquivo | Alteracao |
|---|---|
| Nova migracao SQL | Tabela papers + coluna section + trigger |
| `supabase/functions/chat-papers/index.ts` | Prompt anti-alucinacao + validacao regex pos-IA + injecao de classificacao scite |
| `supabase/functions/classify-citations/index.ts` | Extrair secao do texto (Intro/Methods/Results/Discussion) |
| `supabase/functions/search-papers/index.ts` | Salvar papers novos na tabela papers (upsert por DOI) |
| `src/components/app/CitationBadge.tsx` | Ler contadores da tabela papers ao inves de contar classifications |
| `src/pages/PaperReport.tsx` | Exibir metadados completos da tabela papers + filtro por secao |
| `src/integrations/supabase/types.ts` | Adicionar tipo da tabela papers |

### Sequencia de implementacao

1. Migracao do banco (tabela papers + coluna section + trigger de contadores)
2. Atualizar search-papers para persistir papers no banco
3. Atualizar classify-citations para extrair secao do texto
4. Reescrever prompt do chat-papers com engenharia anti-alucinacao
5. Implementar validacao regex pos-IA no chat-papers
6. Atualizar CitationBadge para usar contadores em cache
7. Atualizar PaperReport com metadados completos e filtro por secao

### Sobre Neo4j e infraestrutura externa

A arquitetura ideal descrita menciona Neo4j (banco de grafos) e Elasticsearch. Para o MVP dentro do Lovable/Supabase, usaremos **PostgreSQL com indices otimizados** para simular as consultas de grafo (JOINs na tabela citations). O pgvector ja cobre a necessidade vetorial. Neo4j e Kafka seriam evolucoes futuras em infraestrutura dedicada fora do Lovable.

### Sobre o Pipeline de Workers (GPU/CPU)

O pipeline descrito com Kubernetes, SQS e workers GPU e para escala de milhoes de artigos. No MVP atual, o processamento ocorre sob demanda via Edge Functions (quando o usuario clica "Classificar"). Para escala futura, seria necessario um repositorio separado com Python + Celery + GROBID.

