

# Melhorias na Integração do CAPES APC Advisor

## Análise da Implementação Atual

A funcionalidade CAPES APC está implementada como um **dialog modal** acionado por um botão na toolbar. Isso funciona, mas tem limitações:

1. O modal desconecta o pesquisador do editor — ele não vê o artigo enquanto navega nas sugestões
2. O fluxo é linear (3 passos) mas sem indicador visual de progresso
3. Após formatar, o modal fecha e o resultado vai para o painel "AI Output" genérico, sem destaque
4. Não há persistência — se fechar o modal, perde tudo
5. O botão "CAPES APC" na toolbar compete visualmente com ações de escrita (Gerar, Continuar, Reformular)

## Melhorias Propostas

### 1. Transformar de Modal para Painel Lateral Dedicado
Substituir o Dialog por um painel que ocupa o espaço do "AI Output" (lado direito) quando ativado, permitindo que o pesquisador veja o editor simultaneamente. Um toggle alterna entre "AI Output" e "CAPES Advisor".

### 2. Stepper Visual de Progresso
Adicionar indicadores de etapa (1→2→3) no topo do painel:
- Etapa 1: Análise e Sugestões
- Etapa 2: Diretrizes de Submissão  
- Etapa 3: Formatação e Checklist

### 3. Checklist Interativo de Submissão (nova Etapa 3)
Após ver as diretrizes, apresentar um checklist interativo com todos os requisitos CAPES e do periódico que o pesquisador pode marcar conforme vai preparando:
- ORCID cadastrado
- Afiliação institucional verificada
- Carta de apresentação preparada
- Artigo formatado
- Co-autores notificados

### 4. Botão CAPES com Destaque Contextual
Mover o botão CAPES para uma posição mais proeminente — ao lado do seletor de seção, com ícone colorido e tooltip explicativo. Quando o artigo tiver conteúdo suficiente (>200 palavras), mostrar um indicador sutil convidando o pesquisador a usar.

### 5. Persistência de Estado no SessionStorage
Salvar sugestões, publisher selecionado e guidelines no sessionStorage para que o pesquisador não perca o progresso ao navegar.

### 6. Comparação Side-by-Side de Publishers
Na etapa 1, permitir selecionar 2-3 publishers para comparar em uma tabela resumida (escopo, quantidade de journals, requisitos) antes de escolher.

### 7. Preview da Formatação Antes de Aplicar
Na etapa de formatação, mostrar um diff/preview do artigo reformatado ao lado do original, permitindo ao pesquisador aprovar antes de inserir no editor.

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/app/CAPESAdvisorPanel.tsx` | Refatorar de Dialog para painel inline; adicionar stepper, checklist, comparação e preview |
| `src/pages/WritingAssistant.tsx` | Integrar painel no layout principal (substituindo AI Output quando ativo); reposicionar botão; adicionar persistência |

## Detalhes Técnicos

- O painel CAPES usará o mesmo espaço do `w-[45%]` do AI Output, controlado por um estado `activeRightPanel: "ai" | "capes"`
- O stepper usa badges numeradas com cores para indicar etapa atual/completa/pendente
- O checklist é local (useState + sessionStorage), sem necessidade de banco
- A comparação de publishers renderiza um grid de Cards lado a lado com scroll horizontal
- O preview de formatação faz a chamada `format_for_journal` mas exibe no painel CAPES antes de inserir no editor, com botões "Aprovar e inserir" / "Descartar"
- Nenhuma mudança em edge functions — apenas UI/UX

