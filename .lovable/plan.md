

# Sugestões de Funcionalidades de Alto Impacto para Busca e Revisão Sistemática

Após análise detalhada do sistema atual (busca multi-fonte, triagem AI com critérios amplos, extração com full-text, relatório PRISMA), seguem as funcionalidades que trariam maior diferencial competitivo frente a ferramentas como Elicit, Covidence, Rayyan e ASReview.

---

## 1. Triagem por Dupla Revisão com Resolução de Conflitos (Dual Screening)

**O que é**: Permitir que dois revisores triem os mesmos artigos independentemente, com painel de concordância (Kappa de Cohen) e resolução de conflitos por um terceiro revisor ou consenso.

**Por que inova**: Covidence cobra caro por isso. Rayyan oferece parcialmente. ScholarAI já tem workspaces colaborativos — adicionar essa camada torna a revisão academicamente defensável e publicável.

**Implementação**: Nova tabela `screening_decisions` (user_id, paper_id, review_id, decision, criteria_results). UI de conflitos no StepScreening com diff visual entre decisões.

---

## 2. Active Learning / Triagem Adaptativa (ASReview-style)

**O que é**: Após o revisor triar manualmente ~20-30 artigos, o modelo aprende o padrão de inclusão/exclusão e re-ranqueia os restantes por probabilidade de inclusão, priorizando os mais relevantes.

**Por que inova**: ASReview é open-source mas exige instalação local de Python. Nenhuma ferramenta web comercial oferece isso de forma nativa integrada ao fluxo de revisão sistemática. Isso pode reduzir o esforço de triagem em 70-95%.

**Implementação**: Edge function que coleta as decisões manuais como exemplos few-shot, re-classifica o restante via LLM, e reordena a fila de triagem. Badge "AI Priority" nos artigos.

---

## 3. Importação de Bases Externas (RIS/BibTeX/EndNote XML/CSV)

**O que é**: Permitir importar artigos de arquivos RIS, BibTeX, EndNote XML e CSV exportados de bases como Scopus, Web of Science, EMBASE e Cochrane Library.

**Por que inova**: Toda revisão sistemática rigorosa exige busca em múltiplas bases. Atualmente o sistema busca apenas via API. Sem importação, o pesquisador não pode usar a ferramenta para revisões publicáveis.

**Implementação**: Parser client-side para RIS/BibTeX/CSV com detecção automática de duplicatas por DOI/título (fuzzy matching). Upload na etapa de Coleta.

---

## 4. Detecção Automática de Duplicatas (Deduplication)

**O que é**: Ao combinar resultados de múltiplas fontes ou importações, identificar e marcar duplicatas automaticamente usando DOI, título normalizado (fuzzy match com Levenshtein/Jaccard) e metadados.

**Por que inova**: É uma etapa obrigatória do PRISMA que atualmente não é feita de forma explícita. Covidence e Rayyan fazem isso. É essencial para credibilidade do fluxo.

**Implementação**: Algoritmo client-side de normalização de títulos + comparação fuzzy. Painel de revisão de duplicatas com merge/descarte manual.

---

## 5. Busca Booleana Avançada + Estratégia de Busca Documentada

**O que é**: Editor de queries booleanas (AND/OR/NOT) com suporte a MeSH terms, wildcards e proximity operators, com tradução automática da query para cada base. Geração de uma "Search Strategy" formal exportável.

**Por que inova**: Revisões publicáveis exigem estratégia de busca reproduzível e documentada. Elicit não oferece isso. É o que diferencia uma ferramenta "exploratória" de uma ferramenta para publicação.

**Implementação**: UI de query builder com blocos visuais (conceito → sinônimos → operadores). Edge function para traduzir a query para sintaxe PubMed, Semantic Scholar e OpenAlex. Exportação da estratégia como tabela formatada no relatório.

---

## 6. Fluxo PRISMA Interativo com Diagrama Automatizado

**O que é**: Diagrama PRISMA 2020 gerado automaticamente e atualizado em tempo real conforme o progresso das etapas (identificação → triagem → elegibilidade → inclusão), com números exatos e motivos de exclusão.

**Por que inova**: O sistema já gera um relatório com PRISMA textual, mas um diagrama visual interativo e exportável (SVG/PNG) que se atualiza automaticamente é diferencial significativo. Covidence oferece algo similar, mas estático.

**Implementação**: Componente React SVG/Canvas que lê os contadores de cada etapa do state do ReviewStepper e renderiza o fluxograma PRISMA 2020. Exportação como imagem.

---

## 7. Avaliação de Qualidade Metodológica (Quality Assessment)

**O que é**: Após a extração, aplicar checklists padronizados de qualidade (CASP, Newcastle-Ottawa Scale, Jadad, ROBINS-I) automaticamente via AI, com override manual.

**Por que inova**: O módulo de Risk of Bias já existe separadamente, mas integrá-lo diretamente no fluxo da revisão sistemática como etapa formal (entre Extração e Relatório) é o que Covidence faz e é requisito para publicação.

**Implementação**: Nova etapa "StepQuality" no ReviewStepper. Seletor de checklist por tipo de estudo. Edge function para avaliação AI + tabela de scores por paper.

---

## Prioridade Sugerida de Implementação

| Prioridade | Funcionalidade | Justificativa |
|---|---|---|
| 1 | Importação RIS/BibTeX | Sem isso, revisões publicáveis são impossíveis |
| 2 | Deduplicação automática | Pré-requisito para importação multi-fonte |
| 3 | Diagrama PRISMA interativo | Diferencial visual imediato, alta percepção de valor |
| 4 | Active Learning na triagem | Inovação técnica de maior impacto em produtividade |
| 5 | Busca booleana + estratégia documentada | Credibilidade acadêmica |
| 6 | Dupla revisão com conflitos | Essencial para equipes e publicações |
| 7 | Quality Assessment integrado | Completa o fluxo de revisão de ponta a ponta |

---

## Seção Técnica

- **Importação RIS/BibTeX**: Parser puro em TypeScript no client (sem dependência de backend). Formato RIS usa tags como `TY`, `TI`, `AU`, `AB`, `DO`. BibTeX usa `@article{...}`. Mapeamento direto para a interface `Paper` existente.
- **Deduplicação**: Normalizar títulos (lowercase, remover pontuação, stop words) e comparar com similaridade Jaccard ≥ 0.85 ou DOI exato. Complexidade O(n²) aceitável para até ~5000 papers.
- **Active Learning**: Usar as decisões manuais como few-shot examples no prompt do `screen-papers`, adicionando contexto "Based on these N papers the reviewer included/excluded, prioritize remaining papers by relevance".
- **PRISMA Diagram**: Componente SVG puro com boxes e setas, posicionamento fixo seguindo o template PRISMA 2020. Dados vêm do state existente no `ReviewStepper`.
- **Busca Booleana**: Componente de query builder com state tree `{ operator: 'AND', children: [{ term, synonyms }] }`. Tradução para sintaxe de cada API no edge function `search-papers`.

