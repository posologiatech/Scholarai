# Redesign do menu de Projeto de Pesquisa

## Problema
Hoje há 21 tabs renderizadas em duas linhas quebradas (`TabsList flex-wrap`). Visualmente parece um sistema legado: ícones pequenos, sem hierarquia, sem agrupamento, sem indicador de seção ativa moderno, sem busca, sem persistência da aba na URL. Comparado a Monday/ClickUp, falta uma navegação lateral organizada por categorias e um cabeçalho de contexto mais "produto".

## Solução (visual + estrutural)

Trocar a `TabsList` horizontal por uma **navegação lateral colapsável estilo ClickUp/Linear** dentro da página do projeto, com:

1. **Sub-sidebar do projeto** (coluna fixa à esquerda do conteúdo, largura 240px, colapsa para 56px só com ícones).
   - Header da sub-sidebar: avatar do projeto (iniciais em gradient), título do projeto truncado, badge de status compacto, e seletor "switcher" de projeto (dropdown).
   - Itens agrupados em seções com label discreto em uppercase 11px:
     - **Workspace**: Visão geral, Atividade
     - **Execução**: Tarefas, Cronograma, Reuniões, Diário de Bordo
     - **Pessoas**: Equipe, Orientações, Autoria CRediT
     - **Conhecimento**: Referências, Publicações, Outputs, Documentos, Brainstorm IA
     - **Governança**: Orçamento, Ética, Conformidade, Riscos, Avaliações
     - **Sistema**: Integrações
   - Cada item: ícone 16px + label, hover sutil (bg-muted/60), ativo com barra lateral 2px no primary + bg-primary/8 + texto em primary, contador opcional à direita (ex.: badge cinza com nº de tarefas pendentes / riscos ativos / próximas reuniões).
   - Footer da sub-sidebar: botão "Pesquisar" (Cmd+K), botão de colapsar.

2. **Header do projeto redesenhado** (acima do conteúdo, fica fora da sub-sidebar):
   - Breadcrumb fino: Projetos / Nome do projeto.
   - Linha 1: título grande (text-2xl font-semibold) editável inline, pill de status com cor semântica + área/edital em texto muted ao lado.
   - Linha 2: barra de ações alinhada à direita — avatares empilhados da equipe (-space-x-2), divisor, Notificações, Exportar, Modo Apresentação, Editar. Tudo em `variant="ghost" size="sm"` com altura uniforme (h-8) e ícones 14px para look ClickUp/Monday.
   - Mini-metrics inline: 4 chips compactos (A fazer, Fazendo, Concluídas, Próx. reuniões) — não mais cards gigantes; viram pills clicáveis que filtram/saltam para a tab correspondente.

3. **Conteúdo da tab** entra num container `rounded-xl border bg-card` único com padding consistente, em vez de soltar `TabsContent` cru.

4. **Persistência e UX**:
   - Aba ativa sincronizada com query string (`?tab=tasks`) usando `useSearchParams` para navegação direta e back/forward funcional.
   - Memorizar estado colapsado da sub-sidebar em `localStorage` (`research-subnav-collapsed`).
   - Em telas <1024px (lg breakpoint), sub-sidebar vira um `Sheet` que abre por botão de menu no header.
   - Atalho `g` + tecla para pular entre seções (ex: g+t = tasks) — bônus opcional.

5. **Polimento visual** (tokens semânticos, sem hex):
   - Sub-sidebar `bg-card`, borda `border-border/60`, sombras `shadow-sm`.
   - Item ativo: `bg-primary/10 text-primary border-l-2 border-primary` (substitui visual genérico do shadcn Tabs).
   - Labels de seção: `text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-3 mt-4 mb-1`.
   - Transições suaves (`transition-all duration-150`) em hover e colapso.
   - Iconografia consistente (todos `h-4 w-4`, stroke-width 1.75).

## Detalhes técnicos

- **Arquivo novo**: `src/components/research/ProjectSubNav.tsx` exporta:
  - `ProjectSubNav({ project, activeTab, onTabChange, counters, collapsed, onToggleCollapse })`.
  - Define `SECTIONS: { id, label, items: { id, icon, labelPt, labelEn, counterKey? }[] }[]`.
  - Renderiza grupos + itens, com `Tooltip` quando colapsada.
- **Arquivo novo**: `src/components/research/ProjectHeader.tsx` — header redesenhado com breadcrumb, título, ações e chips de métricas.
- **Refatoração de `src/pages/ResearchProjectDetail.tsx`**:
  - Substituir `<Tabs><TabsList>...</TabsList><TabsContent>...` pela estrutura:
    ```
    <div className="flex h-[calc(100vh-4rem)]">
      <ProjectSubNav ... />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ProjectHeader ... />
        <div className="flex-1 overflow-auto p-6">
          {renderActiveTab(activeTab)}
        </div>
      </div>
    </div>
    ```
  - Manter `Tabs` apenas como state controller (`value`/`onValueChange`) ou trocar por simples `switch (activeTab)` que renderiza o componente correto — preferir o `switch` para perder o overhead visual do shadcn Tabs.
  - `useSearchParams` para `tab` (default `overview`).
  - Hook `useQuery` leve para `counters` (count de tasks por status, riscos ativos, meetings futuras) reaproveitando queries existentes; pode ser derivado em memória sem nova request se as queries das tabs já estão em cache, ou um único `select count` agrupado.
- **Mobile**: usar `Sheet` do shadcn para a sub-sidebar abaixo de `lg`, com `SheetTrigger` no header (ícone `PanelLeft`).
- **Sem alterar lógica de cada tab** — só o invólucro e a navegação mudam.

## Fora de escopo
- Não mexer no conteúdo interno de cada tab (BudgetTab, ScheduleTab, etc).
- Não alterar schema do banco.
- Não tocar na sidebar global do app (`AppSidebar`).

## Resultado esperado
Página de projeto com presença visual de ferramenta moderna (Linear/ClickUp/Monday): navegação organizada, persistente, com contadores; header limpo com ações agrupadas; conteúdo respira em um card único; comportamento responsivo e com deep-link via URL.
