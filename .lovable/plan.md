
Objetivo: corrigir de forma definitiva a ausência de citações na coluna “Paper”.

Diagnóstico consolidado (com base no código + logs):
- O frontend só mostra o texto de citações quando `paper.citationCount` existe (`src/pages/SearchResults.tsx`).
- No backend, resultados de PubMed saem com `citationCount: undefined` (`supabase/functions/search-papers/index.ts`).
- A mesclagem por DOI só resolve isso quando o mesmo artigo também aparece em outra fonte com contagem (OpenAlex/CrossRef), o que nem sempre acontece.
- Logs atuais mostram degradação de fontes que ajudam nesse enriquecimento (`SemanticScholar 429` e `CORE 500`), então muitos itens ficam sem contagem.
- Para o DOI da imagem (`10.1681/asn.0000000752`), OpenAlex/CrossRef retornam 7 citações — o dado existe, mas não está sendo acoplado de forma confiável no pipeline.

Do I know what the issue is? Sim.
Problema real: o pipeline de busca não garante preenchimento de `citationCount` para itens que vêm de PubMed (ou outras fontes sem contagem nativa), então a UI fica sem valor para renderizar.

Plano de implementação:
1) Fortalecer normalização e chave de merge por DOI (backend)
- Arquivo: `supabase/functions/search-papers/index.ts`
- Criar helper único `normalizeDoi()` (remove `https://doi.org/`, `doi:`, espaços, pontuação final, lowercase).
- Aplicar esse helper em todos os mapeadores (PubMed, OpenAlex, EuropePMC, CrossRef, CORE) e na chave de deduplicação.
- Isso aumenta a chance de merge correto entre fontes do mesmo paper.

2) Melhorar extração do DOI no PubMed (backend)
- Arquivo: `supabase/functions/search-papers/index.ts`
- Em `searchPubMed()`, extrair DOI prioritariamente de `articleids`/campo DOI oficial (quando disponível), e só depois fallback para `elocationid`.
- Opcional: usar `pmcrefcount` como contagem inicial quando existir no retorno do PubMed.

3) Enriquecer citações faltantes após deduplicação (backend)
- Arquivo: `supabase/functions/search-papers/index.ts`
- Adicionar função `enrichMissingCitationCounts(papers)` (similar à de abstracts).
- Para cada paper sem `citationCount` e com DOI:
  - tentativa 1: OpenAlex lookup por DOI (`cited_by_count`);
  - tentativa 2: CrossRef lookup por DOI (`is-referenced-by-count`);
- Executar com limite de concorrência + timeout para não degradar latência.
- Resultado: mesmo com fonte principal = PubMed, o paper recebe contagem quando o DOI existe em OpenAlex/CrossRef.

4) Tornar exibição de citações mais visível no card da coluna “Paper” (frontend)
- Arquivo: `src/pages/SearchResults.tsx`
- Manter texto no metadado, mas adicionar também um badge dedicado de citação na linha de badges quando `citationCount` estiver definido.
- Evita perda visual quando título/journal ocupa muita linha e deixa a informação sempre evidente.

5) Observabilidade e robustez
- Arquivo: `supabase/functions/search-papers/index.ts`
- Logar métricas: quantos papers vieram sem citação e quantos foram enriquecidos.
- Melhorar log de erro do CORE para incluir corpo da resposta (ajuda no ajuste do conector CORE sem impacto no fluxo de citações).

Validação (fim a fim):
- Rodar busca com o caso da imagem e confirmar que o paper mostra contagem.
- Testar com `sourceFilter = pubmed` e com “todas as fontes”.
- Confirmar que clicar no paper continua abrindo detalhes normalmente.
- Verificar logs da função para garantir que o enriquecimento de `citationCount` ocorreu.
