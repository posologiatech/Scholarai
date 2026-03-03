

## Dashboard Builder Interativo para DataMind

### Visão Geral
Permitir que usuários "fixem" gráficos e tabelas gerados durante análises em dashboards persistentes, compartilháveis via link público, com layout configurável.

### Arquitetura

**Banco de dados** — 2 novas tabelas:
- `datamind_dashboards`: id, user_id, title, description, is_public, share_token (unique), layout (jsonb), created_at, updated_at
- `datamind_dashboard_items`: id, dashboard_id, user_id, item_type (chart/table), title, content (jsonb — armazena dados do gráfico base64 ou headers+rows da tabela), position (jsonb — x, y, w, h para grid), source_message_id (ref à mensagem original), created_at

RLS: usuários acessam seus próprios dashboards; dashboards públicos são acessíveis via share_token sem autenticação.

**Frontend — Componentes novos:**

1. **Botão "Pin to Dashboard"** — Adicionado no `DataMindCodeOutput.tsx` em cada bloco de imagem e tabela. Ao clicar, abre um popover para selecionar dashboard existente ou criar novo.

2. **Página `/datamind/dashboards`** — Lista todos os dashboards do usuário com cards preview, opções de editar/excluir/compartilhar.

3. **Página `/datamind/dashboard/:id`** — Visualização do dashboard com grid responsivo usando CSS Grid. Cada item pode ser redimensionado/reordenado via drag. Toolbar com título editável, botão de compartilhamento (copiar link público), e toggle público/privado.

4. **Página `/shared/dashboard/:token`** — Rota pública (sem auth) para visualizar dashboards compartilhados. Renderiza os mesmos componentes de tabela/gráfico em modo read-only.

5. **`DataMindDashboardPinButton.tsx`** — Componente reutilizável com Popover que lista dashboards e permite criar novo inline.

**Fluxo do usuário:**
1. Usuário analisa dados no DataMind → gráfico/tabela é gerado
2. Clica no ícone 📌 no bloco de output
3. Seleciona dashboard existente ou cria novo
4. Item é salvo com os dados (base64 para imagens, headers+rows para tabelas)
5. Acessa `/datamind/dashboards` para ver/gerenciar
6. Ativa "link público" para compartilhar

**Mudanças em arquivos existentes:**
- `DataMindCodeOutput.tsx`: Adicionar botão Pin em cada bloco de imagem e tabela
- `App.tsx`: 3 novas rotas (dashboards list, dashboard detail, shared dashboard)
- `AppSidebar.tsx`: Link para Dashboards dentro da seção DataMind

### Detalhes Técnicos

- **Persistência de gráficos**: Os gráficos são base64 (já existentes no output_content como `[IMG]...[/IMG]`). Serão armazenados diretamente no campo `content` jsonb do item.
- **Persistência de tabelas**: headers + rows já parseados serão salvos no jsonb.
- **Share token**: UUID gerado automaticamente, usado na rota pública.
- **Layout**: Grid simples com posições salvas em jsonb. Sem biblioteca extra de drag — uso de CSS Grid com ordenação por posição.
- **RLS para rota pública**: Policy SELECT em `datamind_dashboards` e `datamind_dashboard_items` permitindo acesso quando `is_public = true` (para a rota shared).

### Arquivos a Criar/Editar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabelas + RLS |
| `src/components/datamind/DataMindDashboardPinButton.tsx` | Criar — botão pin com popover |
| `src/components/datamind/DataMindCodeOutput.tsx` | Editar — adicionar botão pin |
| `src/pages/DataMindDashboards.tsx` | Criar — lista de dashboards |
| `src/pages/DataMindDashboardView.tsx` | Criar — visualização/edição do dashboard |
| `src/pages/SharedDashboard.tsx` | Criar — rota pública |
| `src/App.tsx` | Editar — adicionar rotas |
| `src/components/app/AppSidebar.tsx` | Editar — link Dashboards |

