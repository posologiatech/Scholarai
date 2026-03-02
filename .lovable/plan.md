
# Planilha Interativa estilo Julius.ai no DataMind

## Objetivo
Substituir o preview simples de tabela HTML por um Data Grid interativo estilo Excel, permitindo seleção de colunas, linhas e células, com envio do contexto selecionado para a IA.

## Arquitetura

### Biblioteca escolhida: `react-data-grid`
- Leve, focada em performance com virtualização nativa
- Suporta seleção de linhas, colunas e range de células
- Estilo Excel out-of-the-box
- Sem custo de licença (MIT)

### Dependencias novas
- `react-data-grid` - grid interativo
- `xlsx` (ja instalado) - parsing de Excel client-side

---

## Etapas de Implementacao

### 1. Parsing completo de Excel no client-side
**Arquivo:** `src/pages/DataMind.tsx`

Atualmente, arquivos `.xlsx` nao sao parseados no frontend (apenas CSV). Vamos usar a biblioteca `xlsx` (ja instalada) para extrair **todas as linhas** do arquivo Excel em JSON, nao apenas 5 linhas de preview.

- Ler o arquivo com `xlsx.read(arrayBuffer)`
- Extrair headers e todas as linhas como array de objetos
- Salvar os dados completos no state local (nao no Supabase, que guarda apenas o preview de 5 linhas)
- Limitar a 50.000 linhas para seguranca de memoria

### 2. Novo componente `DataMindSpreadsheet`
**Arquivo:** `src/components/datamind/DataMindSpreadsheet.tsx`

Componente principal que substitui o `DataMindFilePreview` quando ha dados completos:

- Renderiza `react-data-grid` com todas as colunas e linhas
- Header com nome do arquivo, contagem de linhas/colunas
- Texto instrucional: "(Opcional) clique em colunas, linhas ou celulas para focar em dados especificos"
- Barra de status inferior mostrando "X celulas selecionadas" quando ha selecao

**Funcionalidades do grid:**
- Virtualizacao nativa (suporta planilhas grandes)
- Selecao de linhas (clique com Shift/Ctrl)
- Selecao de colunas inteiras (clique no header)
- Range selection (arrastar mouse sobre celulas)
- Estilo visual limpo com headers `bg-muted/50`, linhas zebra

### 3. Estado de selecao (`selectedContext`)
**Arquivo:** `src/pages/DataMind.tsx`

- Novo state: `selectedContext: { data: Record<string, string>[]; summary: string } | null`
- Atualizado pelo callback `onSelectionChange` do `DataMindSpreadsheet`
- Quando o usuario seleciona celulas, o componente extrai os dados exatos selecionados

### 4. Integracao com o Input/Chat
**Arquivo:** `src/components/datamind/DataMindInput.tsx`

- Receber `selectedContext` como prop
- Mostrar badge "X celulas selecionadas" no input quando ha selecao ativa
- Botao para limpar selecao

**Arquivo:** `src/pages/DataMind.tsx` (funcao `sendMessage`)

- Se `selectedContext` nao estiver vazio, anexar os dados selecionados ao prompt como contexto Markdown/CSV
- Trava de seguranca: se a selecao passar de 1000 linhas, mostrar aviso sugerindo usar Python/Pandas para o arquivo inteiro
- Limpar `selectedContext` apos envio

### 5. Ajuste no `DataMindChat`
**Arquivo:** `src/components/datamind/DataMindChat.tsx`

- Substituir `DataMindFilePreview` pelo novo `DataMindSpreadsheet` quando os dados completos estiverem disponiveis
- Manter `DataMindFilePreview` como fallback para arquivos sem dados completos (ex: Excel que falhou no parse)

---

## Fluxo do usuario

```text
Upload .xlsx/.csv
       |
       v
  Parse completo (xlsx/PapaParse)
       |
       v
  Grid interativo aparece no chat
  "(Opcional) clique em colunas, linhas ou celulas..."
       |
       v
  Usuario seleciona celulas/colunas
       |
       v
  Badge "42 celulas selecionadas" no input
       |
       v
  Usuario digita pergunta + envia
       |
       v
  Dados selecionados anexados ao prompt (hidden)
       |
       v
  IA responde com contexto focado
```

---

## Detalhes tecnicos

- **Parsing CSV:** Usar split por linhas (ja existente), expandir para todas as linhas em vez de 5
- **Parsing Excel:** `xlsx.read(buffer, {type:'array'})` -> `xlsx.utils.sheet_to_json(sheet)`
- **Dados completos** ficam apenas no state React (nao sao salvos no Supabase para nao sobrecarregar)
- **Limite de tokens:** Selecoes acima de 1000 linhas exibem toast de aviso
- **Estilo do grid:** altura fixa ~400px com scroll virtual, bordas e cores consistentes com o design system existente
