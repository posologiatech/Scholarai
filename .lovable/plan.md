
# Research Hub — Gestão de Projetos de Pesquisa

Novo módulo integrado ao ScholarAI que centraliza o ciclo de vida de um projeto acadêmico: da ideia → publicação, com orientações, tarefas, reuniões, editais e brainstorm IA. Tudo conectado à Library, Systematic Review, Writing Assistant e Knowledge Graph já existentes.

## 1. Arquitetura de dados (Supabase)

Nova entidade **`research_projects`** independente (não reaproveita `workspaces`), com vínculo opcional a workspace para herdar membros/anotações.

```text
research_projects ── research_project_members (roles: PI, Co-PI, orientando_ic, mestrado, doutorado, posdoc, colaborador)
   │
   ├── research_project_references   (papers vinculados — FK para papers/saved_searches)
   ├── research_project_ideas         (brainstorm: ideia, hipótese, método, status)
   ├── research_idea_nodes + edges    (canvas/mind map — ReactFlow)
   ├── research_tasks                 (kanban: backlog → doing → review → done; assignee, due_date, prioridade)
   ├── research_meetings              (data, participantes, agenda, ata IA, action_items)
   ├── research_advisees              (orientandos: aluno, nível, tema, início, defesa prevista, milestones)
   ├── research_advisee_milestones    (qualificação, depósito, defesa, prazos)
   ├── research_publications          (pipeline: rascunho → submetido → revisão → aceito → publicado; journal, DOI)
   └── research_publication_authors   (ordem, corresponding, contribuição CRediT)

funding_calls                         (editais — global, curados por sistema + manual)
funding_call_subscriptions            (usuário "segue" edital, recebe alerta de prazo)
funding_sources                       (CAPES, CNPq, FAPESP, Finep, FAPs estaduais — RSS/API/manual)
```

RLS: tudo escopo por `research_project_members` via SECURITY DEFINER `is_project_member(uid, project_id)` — segue padrão já estabelecido (`is_workspace_member`).

## 2. Telas (rotas novas)

```text
/research                          Lista de projetos (cards com progresso, próximos prazos)
/research/new                      Wizard criação (título, área, equipe, papers semente)
/research/:id                      Overview (KPIs, próximas tarefas, reuniões, atividades)
/research/:id/team                 Equipe + orientandos + papéis
/research/:id/tasks                Kanban + lista + Gantt simples
/research/:id/meetings             Calendário + ata IA + action items
/research/:id/library              Referências do projeto (importa de Library/SR)
/research/:id/ideas                Brainstorm: chat IA + canvas mind map (ReactFlow)
/research/:id/publications         Pipeline editorial (kanban por status)
/research/:id/advisees             Orientações: timeline por aluno, milestones
/research/funding                  Editais (global): filtros por área/agência/prazo
/research/funding/:id              Detalhe do edital + "seguir" + lembrete
```

Sidebar: novo grupo **"Pesquisa"** com ícones Projetos / Editais.

## 3. Funcionalidades-chave

### 3.1 Projetos & Equipe
- Wizard de criação com área CNPq, palavras-chave, objetivos, equipe.
- Papéis: PI, Co-PI, orientando (IC/Mestrado/Doutorado/Pós-doc), colaborador externo.
- Convite por email (reusa fluxo de workspaces).

### 3.2 Referências
- Botão "Importar da Library" e "Importar de Saved Search/SR".
- Vincula papers do banco `papers` ao projeto; herda RAG/chat-papers já existente.

### 3.3 Tarefas
- Kanban (dnd-kit), filtros por assignee/prazo, sub-tarefas, checklist.
- Vista Gantt simples (timeline horizontal por mês).
- Notificações in-app de prazos.

### 3.4 Reuniões
- Agendamento simples (data/hora/link), agenda em markdown.
- **Upload de áudio/transcrição → edge function `meeting-summarize`** (Lovable AI Gemini) gera ata estruturada + action items que viram tarefas com um clique.

### 3.5 Orientações de alunos
- Por orientando: nível, tema, datas (início, qualificação, depósito, defesa).
- Timeline visual com milestones; alerta automático 30/15/7 dias antes.
- Dashboard do orientador: todos os orientandos em uma só tela.

### 3.6 Publicações
- Pipeline kanban: ideia → escrevendo → submetido → em revisão → aceito → publicado.
- Integração com **Writing Assistant** existente (botão "Abrir no Writing Assistant").
- Autores com ordem e CRediT taxonomy.

### 3.7 Brainstorm IA + Canvas
- **Chat IA contextual** (`research-brainstorm` edge function): conhece projetos do usuário, papers vinculados, gaps de pesquisa (reusa `research-gaps`). Sugere derivações, hipóteses, métodos.
- Botão "Promover para canvas" → cria nó no mind map (ReactFlow).
- Canvas: nós tipados (ideia/hipótese/método/paper/experimento), edges conectam, salva layout.

### 3.8 Editais de fomento
- Curadoria híbrida: edge function `funding-sync` semanal puxa RSS/APIs públicas (CNPq RSS, FAPESP RSS, etc.) → IA classifica área → grava em `funding_calls`.
- Cadastro manual também permitido.
- Usuário "segue" editais relevantes; recebe alerta in-app e email (via Resend já configurado) X dias antes do prazo.

## 4. Integrações com módulos existentes
- **Library / Saved Searches** → importa referências.
- **Systematic Review** → SR pode ser anexada como artefato do projeto.
- **Writing Assistant** → manuscritos linkam para `research_publications`.
- **Knowledge Graph** → botão "Ver grafo das referências do projeto".
- **Research Gaps** → alimenta brainstorm IA.
- **DataMind** → análises podem ser anexadas como artefatos.

## 5. Edge Functions novas
- `research-brainstorm` — chat IA contextual com projetos+papers do usuário.
- `meeting-summarize` — transcreve/sumariza áudio de reunião → ata + action items.
- `funding-sync` (cron semanal) — coleta editais via RSS/APIs + classificação IA.
- `notify-deadlines` (cron diário) — gera notificações de prazos (tarefas, milestones, editais).

Todas seguem padrão obrigatório: JWT dinâmico, validação Zod, CORS, sem service_role no cliente.

## 6. Roadmap de entrega (sequencial, dentro deste release "completo")

1. **Migração schema** + RLS + SECURITY DEFINER helpers + seeds de funding_sources.
2. **CRUD projetos + equipe + referências** + lista + overview.
3. **Tarefas (kanban + Gantt)** + notificações.
4. **Orientações + milestones** + dashboard.
5. **Reuniões** + edge function `meeting-summarize`.
6. **Publicações pipeline** + integração Writing Assistant.
7. **Brainstorm IA + canvas ReactFlow** + edge `research-brainstorm`.
8. **Editais** + edge `funding-sync` + cron + alertas.
9. **Sidebar nav + onboarding** + memória do módulo + i18n PT/EN.

## 7. Riscos & decisões já tomadas
- Entidade separada de `workspaces` (sua escolha) → mais flexibilidade de papéis acadêmicos, mas duplica algum código de membros. Mitigação: helper compartilhado `useProjectMembers`.
- Editais via RSS/API podem ser instáveis → fallback manual sempre disponível, IA marca confiança da fonte.
- Canvas ReactFlow adiciona ~50KB; aceitável dado valor para brainstorm.
- Transcrição de áudio usa Lovable AI (Gemini) — sem custo extra de Whisper.

Pronto para implementar quando você aprovar.
