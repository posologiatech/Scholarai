## Visão geral

Transformar o módulo de Projetos de Pesquisa em uma ferramenta de gestão completa, com fluxo integrado entre Cronograma → Tarefas → Reuniões (pautas) → Encaminhamentos → Tarefas.

## 1. Banco de dados (migração)

**Alterações em tabelas existentes**
- `research_projects`: adicionar `full_content` (text) — corpo livre do projeto (introdução, metodologia, fases, resultados esperados).
- `research_tasks`: adicionar `source_meeting_id` (uuid, FK → research_meetings, nullable) — reunião onde a tarefa foi criada como encaminhamento.
- `research_meetings`: adicionar `notes` (text) — anotações gerais; manter `agenda` legado mas mover estrutura para tabela própria.

**Novas tabelas**
- `research_meeting_agenda_items` — pontos de pauta estruturados
  - `meeting_id`, `title`, `notes` (texto livre/rich), `position`, `source_task_id` (nullable, vínculo com tarefa "fazendo"), `source_schedule_item_id` (nullable), `completed` (bool)
- `research_meeting_attachments` — anexos de cada ponto de pauta
  - `agenda_item_id` (nullable), `meeting_id`, `kind` (file|youtube|link), `file_path` (storage), `file_name`, `mime_type`, `url`, `created_by`
- `research_schedule_items` — cronograma do projeto
  - `project_id`, `title`, `description`, `start_date`, `end_date`, `status` (planejado|em_andamento|concluido|atrasado), `phase`, `position`, `linked_meeting_id` (nullable)
- Bucket de Storage: `research-meetings` (privado) para anexos.

**RLS**: políticas espelham as de `research_meetings`/`research_tasks` — membros do projeto têm acesso via `is_research_project_member`.

## 2. Frontend — alterações por aba

### Overview (Visão geral)
- Bloco no topo: cards de métricas (já existem) + próximas reuniões.
- Novo: editor Markdown grande **"Corpo do projeto"** com seções sugeridas (Introdução, Metodologia, Fases, Resultados Esperados) via template inicial; auto-save com debounce.

### Reuniões
- Lista vira grid de cards clicáveis. Click abre **MeetingDetailDialog** (full-screen sheet).
- Dentro do detalhe:
  - Cabeçalho: título, data, link, participantes, notas gerais.
  - Lista de **Pontos de Pauta** (drag-orderable): cada item expansível com:
    - Campo de **anotações** (textarea rich)
    - Botão para **anexar arquivo** (PDF/DOCX/PPTX → Supabase Storage) e/ou **adicionar link** (URL/YouTube com preview de thumbnail)
  - Seção **Encaminhamentos**: lista de tarefas criadas a partir desta reunião (título, responsável opcional, prazo). Ao salvar, cria registros em `research_tasks` com `status='backlog'` e `source_meeting_id = meeting.id`.
- **Ao criar nova reunião**: dialog com seletor "Importar pautas":
  - Lista todas as tarefas `status='doing'` (Fazendo) do projeto → checkbox para virar pontos de pauta.
  - Lista itens do cronograma com `start_date <= hoje + 14d` e `status != concluido` → checkbox.
  - Itens marcados são inseridos como `research_meeting_agenda_items` com `source_task_id` / `source_schedule_item_id`.

### Tarefas
- Cada card de tarefa exibe badge **"Reunião: <título>"** quando `source_meeting_id` presente (clicável → abre detalhe da reunião).
- Filtro por reunião de origem.

### Cronograma (NOVA aba)
- Visualização lista + timeline horizontal (Gantt simples com barras CSS por mês).
- CRUD de itens (título, fase, datas, status, descrição).
- Cada item tem ação "Vincular à próxima reunião" → marca item para inclusão automática como pauta.

## 3. Redesign

Inspiração: Linear, Height, Notion Projects.

- **Header** do projeto: gradient sutil, breadcrumb, status pill animado, ações primárias à direita.
- **Tabs**: vertical no desktop (sidebar interna) + horizontal no mobile; ícones com cor de acento por aba.
- **Cards**: bordas mais finas, sombras suaves em hover, raio 12px, espaçamento generoso.
- **Kanban tarefas**: colunas com header colorido (cor por status), contador em pill, cards com drag handle, badge de prioridade colorida, badge de reunião de origem.
- **Reuniões**: cards em grid 2 colunas com avatar de cor por status (futura/realizada), preview de pauta, contador de anexos.
- **Cronograma**: timeline com faixas por fase, hoje destacado, itens atrasados em vermelho.
- Tipografia: manter display font do projeto; aumentar leading; usar `text-muted-foreground` consistentemente.
- Tokens semânticos (sem cores hardcoded).

## 4. Detalhes técnicos

```text
Fluxo de pauta automática:
  Cronograma (item próximo) ─┐
                             ├─► Nova Reunião (dialog) ─► agenda_items
  Tarefas (status=doing) ────┘                              │
                                                            ▼
                                          Reunião realizada → encaminhamentos
                                                            │
                                                            ▼
                                          research_tasks (status=backlog,
                                                          source_meeting_id)
                                                            │
                                                            ▼
                                          (quando movida para "doing")
                                                            │
                                                            ▼
                                   próxima reunião sugere como pauta
```

- Upload: `supabase.storage.from('research-meetings').upload(\`\${projectId}/\${meetingId}/\${uuid}-\${filename}\`, file)`; salvar `file_path` na tabela; download via signed URL.
- YouTube: detectar via regex e renderizar `<iframe>` embed.
- Auto-save do corpo do projeto: debounce 1.5s, indicador "Salvando…/Salvo".

## 5. Arquivos a criar/editar

- **Migração**: `supabase/migrations/<timestamp>_research_module_expansion.sql`
- **Editar**: `src/pages/ResearchProjectDetail.tsx` (refactor das abas Overview, Meetings, Tasks; novo redesign)
- **Novos componentes** em `src/components/research/`:
  - `ProjectBodyEditor.tsx`
  - `MeetingDetailDialog.tsx`
  - `AgendaItemRow.tsx`
  - `MeetingAttachmentPicker.tsx`
  - `NewMeetingDialog.tsx` (com importar pautas)
  - `ScheduleTab.tsx`
  - `ScheduleTimeline.tsx`
- **Tipos**: estender `src/lib/research/types.ts`
- **Types Supabase**: regenerados automaticamente após migração

## 6. Fora de escopo desta entrega
- Edição colaborativa em tempo real do corpo do projeto.
- Gantt avançado com dependências (apenas timeline visual simples).
- Transcrição de áudio das reuniões (já existe via `meeting-summarize`, mantemos como está).

Posso prosseguir com a migração e implementação?