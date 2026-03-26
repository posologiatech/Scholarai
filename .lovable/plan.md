

# Redesign Estético do Módulo de Escrita Científica

## Problemas Visuais Atuais

- Toolbar plana e monótona com muitos botões pequenos aglomerados
- Sidebar esquerda sem hierarquia visual clara
- Editor é um Textarea cru sem personalidade
- Painel AI Output sem distinção visual do editor
- Cabeçalhos de seção (Editor, AI Output) sem peso visual
- Ausência de gradientes, sombras e profundidade
- Footer de métricas achatado e sem destaque
- Cores uniformes — tudo cinza/muted sem contraste

## Melhorias Propostas (apenas estética, zero mudança funcional)

### 1. Sidebar Esquerda — Design Premium
- Cabeçalho com gradiente sutil (primary → accent) e ícone com glow
- Tabs com estilo pill/segmented control ao invés de tabs planas
- Cards de papers com borda esquerda colorida (azul para selecionado) e hover com shadow
- Upload area com borda gradient animada (dash animation)
- Fundo com subtle pattern ou gradient mesh muito suave

### 2. Toolbar — Ribbon Moderna
- Fundo com glassmorphism (backdrop-blur + bg-white/80 + shadow-sm)
- Selects (seção, citação) com cantos mais arredondados e ícone decorativo
- Grupos "Escrita" e "Revisão" com background mais definido, border arredondado e label com cor distinta (azul para escrita, púrpura para revisão)
- Botões com hover que inclui scale sutil (transform scale-105) e cor de fundo
- Botão CAPES APC com gradient (primary → accent) quando ativo
- Badges de fontes selecionadas com cores distintas por tipo (azul papers, verde DataMind, laranja PDFs)

### 3. Editor — Experiência de Escrita Premium
- Remover aparência de Textarea: usar contentEditable-style com padding generoso, line-height mais espaçado
- Fundo sutilmente texturizado (linhas horizontais tipo caderno acadêmico) via CSS
- Cabeçalho "Editor" com ícone animado quando está escrevendo
- Placeholder com tipografia elegante e centralizada verticalmente
- Borda interna com shadow-inner sutil para profundidade

### 4. Painel AI Output — Destaque Visual
- Fundo com gradiente sutil de primary/5 para criar contraste com o editor
- Cabeçalho com acento de cor (borda superior colorida ou glow)
- Texto gerado com animação de typing suave (opacity transition)
- Badges de validação com cores vibrantes e ícones animados
- Botões "Copiar" e "Inserir" com estilo pill e hover gradiente
- Empty state com ilustração SVG inline (ícone grande + texto elegante)

### 5. Footer de Métricas — Dashboard Compacto
- Background com gradiente horizontal sutil
- Cada métrica em um "chip" com fundo próprio e cor semântica
- Indicadores de qualidade com mini progress bars em vez de apenas números
- Separadores verticais com gradiente fade

### 6. Barra de Instruções — Input Refinado
- Input com ícone de lâmpada/brain à esquerda
- Fundo com gradiente muito sutil de accent
- Focus ring com glow animado
- Placeholder com animação de typing (CSS only)

## Arquivo Alterado

| Arquivo | Mudança |
|---------|---------|
| `src/pages/WritingAssistant.tsx` | Classes Tailwind atualizadas em todos os elementos JSX; nenhuma alteração em lógica, estado, callbacks ou estrutura de componentes |

## Detalhes Técnicos

- Todas as mudanças são exclusivamente classes CSS/Tailwind — zero alteração em useState, useCallback, useEffect, handlers ou fluxo de dados
- Glassmorphism via `backdrop-blur-md bg-white/80 dark:bg-slate-900/80`
- Gradient borders via `bg-gradient-to-r from-primary to-accent` em wrappers
- Hover animations via `transition-all hover:scale-[1.02] hover:shadow-md`
- Editor "notebook lines" via CSS background-image com `repeating-linear-gradient`
- Dark mode mantido via classes `dark:` existentes

