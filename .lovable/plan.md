

# Plano: Funcionalidades Inspiradas no scite.ai

## Status Atual - O que JA existe no seu sistema

| Funcionalidade | Status |
|---|---|
| Assistente de Pesquisa (Chat RAG com citacoes) | Implementado |
| Extracao de colunas com citacoes verificaveis | Implementado |
| Dashboard com historico de buscas | Implementado |
| Busca com tabela virtualizada e colunas | Implementado |
| Upload de PDFs + extracao automatica | Implementado |
| Relatorios/Sintese de pesquisas | Implementado |
| Biblioteca de pesquisas salvas | Implementado |
| Landing page institucional | Implementado |
| Autenticacao com aprovacao de admin | Implementado |

## O que sera implementado (4 funcionalidades novas)

### 1. Classificador de Citacoes Inteligentes

Nova Edge Function `classify-citations` que recebe um paper e analisa o contexto de cada citacao encontrada no texto completo (via chunks armazenados no banco vetorial), classificando em:

- **Apoiando** (Supporting) - verde
- **Contrastando** (Contrasting) - vermelho  
- **Mencionando** (Mentioning) - cinza

**Como funciona**: Para cada paper, buscamos os chunks que contem referencias a outros papers. A IA classifica o contexto de cada citacao usando o trecho exato onde ela aparece. O resultado e salvo em uma nova tabela `citation_classifications`.

**Arquivos envolvidos**:
- `supabase/functions/classify-citations/index.ts` (nova Edge Function)
- Nova migracao para tabela `citation_classifications` (paper_id, cited_paper_id, classification, citation_context, created_at)

### 2. Badges de Citacao nos Resultados de Busca

Cada paper na tabela de resultados exibira um mini-badge colorido mostrando a contagem de citacoes classificadas:

```text
+-------+----------+-----------+
| 12 Ap | 3 Cont   | 45 Menc   |
| verde | vermelho | cinza     |
+-------+----------+-----------+
```

**Arquivos envolvidos**:
- `src/components/app/CitationBadge.tsx` (novo componente)
- `src/pages/SearchResults.tsx` (adicionar badge na coluna Paper)

### 3. Pagina de Relatorio do Artigo (Article Report)

Nova pagina `/paper/:id` com visao detalhada de um paper especifico:

- Metadados no topo (titulo, autores, resumo, DOI)
- Grafico de pizza/barras com o "Indice de Citacoes" (Apoio vs Contraste vs Mencao)
- Lista dos trechos exatos de outros artigos que citam este paper, com filtro por tipo (Apoio/Contraste/Mencao)
- Botao para ver o paper original

**Arquivos envolvidos**:
- `src/pages/PaperReport.tsx` (nova pagina)
- `src/App.tsx` (adicionar rota `/paper/:id`)
- Utiliza `recharts` (ja instalado) para o grafico

### 4. Verificador de Referencias (Reference Check)

Nova pagina `/reference-check` onde o usuario faz upload de um manuscrito (PDF) e o sistema:

1. Extrai todas as referencias citadas no documento
2. Busca cada referencia no banco de dados
3. Verifica se alguma foi retratada ou amplamente contestada
4. Gera um relatorio visual com sinalizacao verde/amarelo/vermelho

**Arquivos envolvidos**:
- `src/pages/ReferenceCheck.tsx` (nova pagina)
- `supabase/functions/check-references/index.ts` (nova Edge Function)
- `src/App.tsx` (adicionar rota `/reference-check`)

## Sobre a Extensao de Navegador

A extensao de navegador (Chrome/Firefox) **nao pode ser implementada dentro do Lovable**, pois requer um projeto separado com manifest.json, content scripts e publicacao nas lojas de extensoes. Isso precisaria ser desenvolvido em um repositorio separado. Posso criar a **landing page** explicando a extensao, mas o plugin em si esta fora do escopo da plataforma.

## Sequencia de implementacao

1. Migracao do banco (tabela `citation_classifications`)
2. Edge Function `classify-citations`
3. Componente `CitationBadge` + integracao na tabela de resultados
4. Pagina `PaperReport` com grafico e lista de citacoes
5. Edge Function `check-references` + pagina `ReferenceCheck`
6. Atualizacao de rotas e navegacao

## Consideracoes tecnicas

- O classificador usa a IA generativa (Gemini) para analisar o contexto de cada citacao. Para escala massiva, seria ideal treinar um modelo menor (BERT/RoBERTa), mas para o MVP a abordagem com LLM e viavel e precisa
- A verificacao de retratacoes consulta a API do Retraction Watch / CrossRef quando disponivel, com fallback para analise via IA
- Os badges sao carregados sob demanda (lazy) para nao atrasar a renderizacao da tabela de resultados

