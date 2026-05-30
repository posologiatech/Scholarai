## Objetivo

Transformar o módulo de Projetos de Pesquisa no **centro de gravidade** da plataforma: cada módulo (busca de artigos, Biblioteca, DataMind, Escrita Científica, Surveys, Editais de Fomento, Revisão Sistemática, Meta-análise, Knowledge Graph) passa a poder ser vinculado a um projeto, alimentando-o automaticamente com referências, dados, tarefas, publicações e atividade — eliminando trabalho manual de copiar/colar entre módulos.

## Arquitetura de integração

A espinha dorsal é um **vínculo bidirecional** + um **hub central** dentro do projeto.

```text
                ┌─────────────────────────────┐
                │   PROJETO DE PESQUISA (hub)  │
                │  aba "Recursos / Conexões"   │
                └──────────────┬──────────────┘
        ┌──────────┬───────────┼───────────┬──────────┐
   Busca/Biblioteca  DataMind  Escrita   Surveys   Editais / RS
   (papers→refs)   (análises) (→pubs)  (coleta)  (fomento/revisão)
```

**Mecanismo único:** uma tabela `research_project_links` registra qualquer recurso conectado (tipo + id externo + rótulo + metadados), gerando um feed de atividade e contadores. Em paralelo, cada entidade-mãe dos módulos recebe uma coluna opcional `research_project_id`, permitindo "este recurso pertence ao projeto X" e filtragens nativas nas listagens existentes.

## Fases

### Fase 1 — Fundação de vínculo (banco + UI base)
- Migração: coluna `research_project_id` (FK opcional) em `datamind_conversations`, `surveys`, `writing_documents`, `systematic_reviews`, `saved_searches`.
- Nova tabela `research_project_links` (project_id, resource_type, resource_id, label, url, metadata, created_by) com GRANTs + RLS via `is_research_project_member`.
- Nova aba **"Conexões"** no `ProjectSubNav` (seção Conhecimento) com cartões por módulo mostrando recursos vinculados, contadores e botões "Vincular existente" / "Criar novo no contexto do projeto".
- Seletor reutilizável `<ProjectPicker>` (combobox) usado em todos os módulos para vincular a um projeto.

### Fase 2 — Busca de artigos & Biblioteca → Referências (automação)
- Em SearchResults/Library: botão "Salvar no projeto" que insere em `research_project_references` e dispara embedding/RAG (já existe `match_project_paper_chunks`).
- Importação em lote de uma busca salva inteira para as referências do projeto.
- Referências vinculadas ficam disponíveis ao Copilot do projeto (RAG já implementado) e à Escrita Científica.

### Fase 3 — Escrita Científica ↔ Publicações
- `writing_documents` ganha `research_project_id`; documentos do projeto aparecem na aba Publicações.
- Ação "Promover a publicação": ao marcar um documento como submetido, cria/atualiza linha em `research_publications` (status, periódico-alvo, DOI), reaproveitando o enriquecimento OpenAlex/Altmetric já existente.
- O editor de escrita pode puxar as referências do projeto como base bibliográfica.

### Fase 4 — DataMind ↔ Projeto
- `datamind_conversations` ganha `research_project_id`; análises do projeto listadas na aba Conexões.
- Dataset/relatório gerado no DataMind pode ser registrado como **Output** (`research_outputs`) com um clique.
- Surveys do projeto (dados coletados) podem abrir diretamente no DataMind já vinculadas.

### Fase 5 — Surveys (coleta de dados) ↔ Projeto
- `surveys` ganha `research_project_id`; aba Conexões mostra surveys e status de coleta (respostas, conclusão).
- Criar survey "a partir do projeto" herda equipe e contexto; conclusão da coleta gera tarefa automática ("Analisar dados coletados").

### Fase 6 — Editais, Revisão Sistemática e Meta-análise
- Editais: `funding_call_id` já existe — exibir card do edital vinculado na Visão Geral com prazo e gerar marcos automáticos (já há `FundingLinkCard`); permitir vincular/assinar editais a partir da aba Conexões.
- `systematic_reviews` ganha `research_project_id`; papers incluídos na RS podem ser importados como referências do projeto em lote.
- Meta-análise vinculada listada como recurso; resultados exportáveis como Output.

### Fase 7 — Motor de automação e feed unificado
- Centralizar regras de automação (ex.: vincular busca → cria referências + tarefa; concluir survey → tarefa de análise; promover escrita → publicação) num helper `src/lib/research/integrations.ts`.
- Toda ação de vínculo grava em `research_project_links` e em `research_notifications`, alimentando a aba Atividade e o sino de notificações já existentes.

## Detalhes técnicos

- **Banco:** apenas colunas nullable + 1 tabela nova (sem quebrar dados existentes). FKs com `on delete set null` para não apagar recursos ao excluir projeto. GRANTs (`authenticated`, `service_role`) + RLS por `is_research_project_member` em `research_project_links`.
- **Tipos:** atualizar `src/lib/research/types.ts` (novo `ResearchProjectLink`, `resource_type` enum). O `types.ts` do Supabase é regenerado após a migração.
- **UI:** novo `ConnectionsTab.tsx` + `ProjectPicker.tsx`; pequenos botões "Vincular ao projeto" injetados nas páginas Library, SearchResults, DataMind, WritingAssistant, Surveys, SystematicReview.
- **Sem novos secrets** — reutiliza edge functions e RAG já existentes.
- **i18n:** rótulos PT/EN; saídas de RS/relatórios permanecem em pt-BR conforme regra do projeto.

## Entrega incremental

Recomendo construir Fase 1 (fundação) + Fase 2 (artigos→referências, maior impacto imediato) primeiro, validar, e seguir para as demais. Posso implementar todas em sequência se preferir.