
# Buscar Texto Completo dos Artigos para Extração

## Problema
Atualmente, a extração de dados usa apenas o **abstract** dos artigos, que geralmente tem 200-300 palavras e não contém detalhes como tamanho da amostra, metodologia específica, resultados numéricos, etc. Por isso, a maioria dos campos retorna "Não mencionado".

## Solução
Criar um pipeline que busca o **texto completo** dos artigos em fontes de acesso aberto antes da extração, permitindo que a IA analise o conteúdo integral.

## Como vai funcionar

```text
Artigos incluídos
       |
       v
[Buscar texto completo]  <-- Nova etapa
  - Europe PMC (XML gratuito para artigos OA)
  - Unpaywall (encontra PDFs abertos via DOI)
       |
       v
[Indexar conteúdo]  <-- embed-papers atualizado
  - Usa texto completo quando disponível
  - Fallback para abstract
       |
       v
[Extrair dados]  <-- Já existente, agora com mais contexto
```

## Etapas de Implementação

### 1. Criar edge function `fetch-full-text`
Nova função que tenta obter o texto completo de cada artigo:
- **Europe PMC**: API gratuita que retorna XML do texto completo para artigos de acesso aberto (`/fullTextXML`)
- **Unpaywall**: API gratuita que encontra URLs de PDFs abertos via DOI
- Converte XML/HTML para texto limpo
- Retorna o texto completo ou indica que não está disponível

### 2. Atualizar `StepExtraction.tsx`
- Adicionar nova etapa "Buscando texto completo..." antes do embedding
- Mostrar progresso (ex: "12/25 artigos com texto completo encontrado")
- Passar o texto completo para o embed-papers

### 3. Atualizar `embed-papers`
- Aceitar campo `full_text` opcional nos papers
- Quando disponível, indexar o texto completo em vez do abstract
- Gera chunks maiores e mais ricos para busca semântica

### 4. Atualizar `extract-column`
- Quando há texto completo disponível via chunks semânticos, priorizar esse conteúdo
- Ajustar o prompt para indicar que o texto completo está disponível

## Detalhes Técnicos

### Nova Edge Function: `supabase/functions/fetch-full-text/index.ts`
- Recebe array de papers com IDs, DOIs e source
- Para papers do Europe PMC: chama `https://www.ebi.ac.uk/europepmc/webservices/rest/{source}/{id}/fullTextXML`
- Para papers com DOI: chama Unpaywall `https://api.unpaywall.org/v2/{doi}?email=team@arca.research`
- Se encontrar PDF URL via Unpaywall, usa Gemini Vision para extrair texto do PDF
- Retorna mapa de paper_id -> full_text
- Processa em lotes de 3-5 para evitar sobrecarga

### Modificações em `src/components/app/systematic-review/StepExtraction.tsx`
- Adicionar estado `fetchingFullText` e `fullTextProgress`
- Nova função `fetchFullTexts()` chamada antes de `embedPapers()`
- Passa full_text para embed-papers quando disponível
- UI mostra "Buscando texto completo dos artigos... (X/Y encontrados)"

### Modificações em `supabase/functions/embed-papers/index.ts`
- Aceitar campo `full_text` no objeto paper
- Priorizar `full_text` sobre `abstract` para chunking
- Marcar source como `full_text` nos chunks

### Modificações em `supabase/functions/extract-column/index.ts`
- Quando semantic chunks vêm de `full_text`, informar a IA no prompt que o texto completo está disponível
- Remover instrução de inferência quando texto completo está disponível (extração direta)

### Config: `supabase/config.toml`
- Adicionar entrada para a nova função `fetch-full-text` com `verify_jwt = false`

## Limitações
- Nem todos os artigos têm texto completo aberto (muitos são pagos)
- Para artigos sem texto completo, o sistema continuará usando abstract + inferência
- O progresso mostrará quantos artigos tiveram texto completo encontrado vs. apenas abstract
