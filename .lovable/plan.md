

# Funcionalidades de Alto Impacto para Ilustrações Científicas

## Estado Atual
O módulo atual gera ilustrações via IA (Gemini 3 Pro Image) com prompt textual, salva no Supabase Storage e exibe numa galeria simples com download PNG e exclusão. É funcional, mas básico comparado a ferramentas como BioRender, Miro e Canva Docs.

---

## Funcionalidades Propostas

### 1. Edição de Imagem por Instrução (AI Image Editing)
Permitir que o usuário selecione uma ilustração já gerada e dê instruções de edição em linguagem natural ("adicione uma legenda no canto", "mude a cor das mitocôndrias para azul", "remova o texto da direita"). Usa o mesmo modelo Gemini com a imagem existente como input.

- Botão "Editar com IA" em cada card da galeria e no resultado atual
- Modal com preview da imagem + campo de instrução
- Salva como nova versão mantendo histórico

### 2. Templates de Ilustração Científica por Área
Biblioteca de templates pré-definidos organizados por categoria (Biologia Celular, Anatomia, Química, Fluxogramas de Pesquisa, Diagramas Estatísticos). O usuário escolhe um template e customiza via prompt.

- Grid de categorias com ícones visuais
- Cada template tem prompt-base otimizado + preview de exemplo
- Reduz a barreira de "o que escrever" e melhora a qualidade dos resultados

### 3. Exportação Multi-formato (SVG, PDF, TIFF)
Além do PNG atual, permitir exportação em formatos exigidos por periódicos: SVG (vetorial), PDF (alta resolução), TIFF (300+ DPI). Essencial para publicação.

- Menu dropdown de exportação no card
- Conversão client-side usando Canvas API e jsPDF (já instalado)

### 4. Anotação e Labels Editáveis
Após gerar a ilustração, permitir que o usuário adicione/edite labels, setas e caixas de texto diretamente sobre a imagem via overlay HTML/Canvas.

- Toolbar com ferramentas: texto, seta, retângulo, círculo
- Drag-and-drop para posicionar anotações
- Exporta a composição final (imagem + anotações) como PNG/PDF

### 5. Variações e Estilos
Gerar múltiplas variações de uma mesma descrição com estilos diferentes: "BioRender flat", "Textbook sketch", "3D render", "Watercolor scientific". O usuário escolhe o melhor.

- Seletor de estilo antes de gerar
- Botão "Gerar 3 variações" que faz chamadas paralelas
- Comparação side-by-side

### 6. Ilustração a partir de Paper/Abstract
Integração com o restante do sistema: o usuário seleciona um paper da biblioteca e a IA gera automaticamente uma figura representativa do estudo (diagrama de métodos, fluxo do estudo, graphical abstract).

- Botão "Gerar Graphical Abstract" na Library e nos resultados de busca
- Usa título + abstract como contexto para o prompt
- Diferencial único no mercado — nenhum concorrente faz isso

### 7. Galeria Comunitária (Discover)
Seção "Explorar" com ilustrações públicas compartilhadas por outros usuários (opt-in). Permite descobrir, copiar prompts e usar como inspiração.

- Toggle "Compartilhar na comunidade" no card
- Feed de ilustrações populares com filtro por área
- Botão "Usar este prompt" que copia para o gerador

---

## Prioridade de Implementação

| # | Funcionalidade | Impacto | Complexidade |
|---|---|---|---|
| 1 | Edição por instrução AI | Alto — reuso e refinamento | Média |
| 2 | Templates por área | Alto — reduz fricção | Baixa |
| 3 | Variações e estilos | Alto — diferencial visual | Média |
| 4 | Graphical Abstract de Paper | Muito alto — diferencial único | Média |
| 5 | Exportação multi-formato | Alto — requisito para publicação | Baixa |
| 6 | Anotação editável | Médio — melhora utilidade | Alta |
| 7 | Galeria comunitária | Médio — engajamento | Alta |

---

## Plano de Implementação (features 1-5, maior impacto/viabilidade)

### Arquivos a criar/modificar:
- **`src/pages/Illustrations.tsx`** — Redesign completo com: seletor de estilo, templates, botão editar, exportação multi-formato, integração com papers
- **`supabase/functions/generate-illustration/index.ts`** — Adicionar suporte a edição (receber imagem existente + instrução) e estilos diferentes no prompt do sistema
- **`src/i18n/translations.ts`** — Novas strings para templates, estilos, edição, exportação
- **`src/components/app/IllustrationEditor.tsx`** (novo) — Modal de edição AI com preview + instrução
- **`src/components/app/IllustrationTemplates.tsx`** (novo) — Grid de templates por categoria

### Detalhes técnicos:
- **Edição AI**: Mesma API Gemini, enviando imagem base64 existente + instrução textual como `content: [{type: "text"}, {type: "image_url"}]`
- **Estilos**: Modificar o system prompt com instruções específicas por estilo selecionado
- **Variações**: 2-3 chamadas paralelas à API com seed/temperature diferentes
- **Exportação PDF**: Usar jsPDF já instalado; SVG via Canvas `toDataURL("image/svg+xml")`
- **Graphical Abstract**: Novo parâmetro `paperContext` no edge function que injeta título+abstract no prompt

