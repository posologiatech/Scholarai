# Módulo Projeto de Pesquisa — Plano de funcionalidades "killer"

Objetivo: transformar o módulo num produto autônomo, tão valioso que justifique sozinho a assinatura da plataforma. Benchmark: Notion + Asana + Monday + Overleaf + Labii + Benchling + LabArchives + ResearchRabbit + Scite + Grant Forward.

O plano está agrupado em 7 pilares. Cada item indica o ganho de valor e o que já existe na base atual (overview, reuniões com pauta/anexos, tarefas, cronograma).

---

## 1. Inteligência de Pesquisa (o grande diferencial)

- **AI Research Copilot do Projeto** — agente lateral que conhece TUDO do projeto (overview, reuniões, tarefas, cronograma, anexos, papers da Biblioteca vinculados). Responde "o que decidimos sobre X na última reunião?", "quais tarefas atrasam o milestone Y?", "resuma o estado atual para o comitê".
- **Gerador de Próximos Passos** — após cada reunião, IA sugere encaminhamentos, riscos e tarefas com prazos plausíveis baseados no histórico do projeto.
- **Detecção de Bloqueios e Riscos** — análise semanal: tarefas paradas, dependências do cronograma em risco, ausência de reuniões, gaps no overview. Gera um "Project Health Score".
- **Vínculo com a Biblioteca e RAG** — anexar papers ao projeto e perguntar em linguagem natural ("quais artigos justificam minha metodologia?"), com citações reais.
- **Auto-redação do Projeto** — a partir do overview + objetivos + keywords, gera rascunhos de Introdução, Metodologia, Cronograma textual e Resultados Esperados, sempre editáveis (zero fabricação, com citações da Biblioteca).

## 2. Gestão de Orientação e Equipe

- **Modo Orientador/Orientando** — papéis explícitos (PI, co-PI, orientando, bolsista, colaborador). Dashboard do orientador mostra todos os projetos sob sua tutela em um único painel.
- **Reuniões de Orientação Recorrentes** — template de reunião 1:1 com seções fixas (avanços, dificuldades, próximas entregas, leituras da semana) e linha do tempo de evolução do orientando.
- **Diário de Bordo do Pesquisador** — registro datado de progresso, hipóteses, decisões metodológicas (estilo Electronic Lab Notebook), assinável e exportável para defesa.
- **Avaliação por Marcos** — orientador pontua entregas; relatório consolidado vira evidência para bolsa CNPq/CAPES.

## 3. Cronograma e Execução (nível Monday/Asana)

- **Gantt interativo de verdade** — drag/resize, dependências (FS/SS), caminho crítico, baseline vs. atual.
- **Visões múltiplas** — Gantt, Kanban, Calendar, Timeline, Workload por pessoa.
- **Templates de cronograma por tipo de projeto** — Iniciação Científica, Mestrado, Doutorado, Pós-doc, Edital CNPq Universal, Edital FAPESP, Ensaio Clínico (fases CONEP). Aplicar em 1 clique.
- **Dependências reuniões ↔ tarefas ↔ cronograma** (parcialmente já existe) — qualquer mudança propaga e alerta.
- **Burndown e velocity** por sprint/mês.

## 4. Conformidade e Documentos Oficiais

- **Plataforma Brasil / CEP-CONEP** — checklist e gerador de TCLE, TALE, Termo de Sigilo, Folha de Rosto, com metadados LGPD (já há base no módulo clínico — integrar aqui).
- **Plano de Gestão de Dados (DMP)** — gerador no padrão FAIR / Horizon Europe / CNPq, vinculado ao projeto.
- **Comitê de Ética — tracker** — submissões, pareceres, emendas, prazos, anexos versionados.
- **Conflito de Interesse e Autoria** — formulário CRediT (14 papéis) por membro; gera declaração pronta para submissão.

## 5. Financiamento e Prestação de Contas

- **Orçamento do Projeto** — rubricas (custeio, capital, bolsas, diárias), execução vs. previsto, alertas de saldo.
- **Tracker de Editais** — integração com o módulo Funding existente; vincular projeto a edital, prazos automáticos no cronograma.
- **Prestação de Contas** — upload de notas fiscais, classificação por rubrica, exportação no template do financiador.
- **Gerador de Relatório Parcial/Final** — preenche automático com dados do projeto + métricas de produção.

## 6. Produção Científica e Impacto

- **Pipeline de Publicação** — para cada artigo planejado: ideia → rascunho → submissão → revisão → publicação. Vincula ao Writing Assistant, à Biblioteca e ao ORCID.
- **Vitrine de Outputs** — papers, datasets, códigos, patentes, apresentações, mídia — tudo com DOI/handle quando aplicável.
- **Indicadores em tempo real** — citações dos outputs (via OpenAlex/Crossref), Altmetric, downloads. Score de impacto do projeto.
- **Página Pública do Projeto** (opcional) — landing institucional com objetivos, equipe, outputs, financiadores — bom para sites de laboratório.

## 7. Colaboração e Experiência

- **Comentários, menções @ e threads** em qualquer bloco (tarefa, item de pauta, parágrafo do overview, item do cronograma).
- **Notificações inteligentes** — digest diário, regras por papel ("só me avise se sou responsável e o prazo é <48h").
- **Versionamento do Overview e documentos** — diff visual estilo Google Docs.
- **Modo Apresentação** — abre o projeto em formato slides para defesa/banca em 1 clique, montado a partir do overview e métricas.
- **Exportação completa** — PDF executivo, ZIP com toda a documentação, formato CNPq Lattes/Sucupira.
- **Integrações** — Google Calendar/Outlook (reuniões), Drive/OneDrive (anexos), Zotero/Mendeley (refs), ORCID (autoria), GitHub (código), Overleaf (manuscritos).

---

## Os 5 itens que SOZINHOS justificam a plataforma

Se for preciso priorizar, estes 5 criam o "uau" que nenhum concorrente brasileiro entrega num único produto:

1. **AI Research Copilot do Projeto** (memória total do projeto + RAG na Biblioteca).
2. **Auto-geração de documentos oficiais** (TCLE, DMP, relatórios CNPq/CAPES, prestação de contas) a partir dos dados já no sistema.
3. **Gantt com dependências + propagação automática para pauta de reuniões e tarefas**.
4. **Modo Orientador** com dashboard multi-orientando e diário de bordo assinável.
5. **Pipeline de Publicação ↔ ORCID ↔ Altmetric** — fechando o ciclo da ideia ao impacto, com indicadores vivos.

---

## Sugestão de fases de entrega

```text
Fase 1 (foundational, 2-3 semanas)
  - AI Research Copilot do projeto (RAG sobre overview/reuniões/tarefas/cronograma)
  - Gantt interativo com dependências
  - Comentários + menções @ + notificações

Fase 2 (compliance & funding, 2-3 semanas)
  - Gerador de TCLE/DMP/Relatórios
  - Orçamento + prestação de contas
  - Tracker de Comitê de Ética

Fase 3 (orientação & impacto, 2-3 semanas)
  - Modo Orientador + Diário de Bordo
  - Pipeline de Publicação + ORCID + Altmetric
  - Modo Apresentação + exportação executiva
```

---

## Pergunta antes de implementar

Quer que eu detalhe um plano técnico de implementação para os **5 itens prioritários** acima, ou prefere escolher 1-2 para começarmos agora (ex.: AI Copilot do Projeto + Gantt interativo)?
