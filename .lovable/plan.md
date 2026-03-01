

# Tabelas estilo planilha incorporada (Julius-style)

## Objetivo
Transformar a renderizacao das tabelas no DataMind para parecerem planilhas incorporadas, como no Julius (imagem de referencia), em vez de simples tabelas HTML.

## Mudancas visuais

A tabela atual ja tem estrutura basica (row numbers, headers, zebra-striping), mas precisa de ajustes para parecer uma planilha real:

### 1. Header da tabela (`InlineTable`)
- Titulo em negrito acima da tabela (ex: "Top 10 PRM (problemas)") extraido do contexto
- Subtitulo cinza com metadata: "2 cols, 10 rows returned"
- Botoes de exportacao (Google Sheets, download, fullscreen) alinhados a direita no header

### 2. Estilo de planilha
- Coluna de indice com fundo cinza claro e borda direita, simulando a coluna de numeros de uma planilha
- Headers com fundo branco, borda inferior mais grossa, fonte semibold
- Celulas com bordas visiveis (grid completo, nao so linhas horizontais)
- Hover na linha inteira com destaque sutil
- Remover truncamento: celulas devem expandir para mostrar conteudo completo
- Borda externa arredondada e sombra sutil para dar efeito "flutuante"

### 3. Fullscreen para tabelas
- Adicionar botao de expandir (icone de maximize) como no Julius
- Ao clicar, tabela abre em overlay fullscreen com scroll

## Arquivo a modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/datamind/DataMindCodeOutput.tsx` | Redesign do componente `InlineTable` para estilo spreadsheet |

## Detalhes tecnicos

### Estrutura visual do header
```text
+--------------------------------------------------+
| Top 10 PRM (problemas)                           |
| 2 cols, 10 rows returned    [Sheets] [DL] [Max]  |
+--------------------------------------------------+
|    | PRM                              | count     |
|----|----------------------------------|-----------|
| 1  | Necessario renovar o controle... | 509       |
| 2  | Falta do controle...             | 211       |
+--------------------------------------------------+
```

### Mudancas CSS no InlineTable
- Grid com `border-collapse` e bordas em todas as celulas
- Coluna `#` com `bg-muted/40` e `border-r`
- Headers com `sticky top-0` para scroll interno
- Container com `max-h-[500px] overflow-y-auto` para tabelas grandes
- Sombra `shadow-sm` no container externo

### Label da tabela
- Atualmente o label e generico ("2 cols, 10 rows"). Manter isso como subtitulo
- Adicionar logica para extrair titulo do bloco de texto que precede a tabela (o titulo como "Top 10 PRM" vem do `print()` no Python). A funcao `parseBlocks` sera ajustada para detectar quando um bloco de texto de uma unica linha curta precede imediatamente uma tabela e usa-lo como titulo da tabela

