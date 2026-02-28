

# DataMind - Plataforma de Análise de Dados por IA

## Visão Geral
Criar uma nova funcionalidade "DataMind" no ScholarAI, inspirada no Julius.ai, para análise de dados com IA. Inclui chat estilo notebook, upload de arquivos CSV/Excel, geração e execução de código Python via E2B Sandbox, e visualização de gráficos.

## Pré-requisito: API Key E2B
Antes de implementar, será necessário adicionar a chave de API do E2B como secret no Supabase. Você pode obter uma em [e2b.dev](https://e2b.dev).

## Arquitetura

```text
[Upload CSV/Excel] --> [Supabase Storage]
         |
         v
[Chat Input] --> [Edge Function: datamind-chat]
                        |
                        v
                 [Lovable AI Gateway]
                 (gera código Python)
                        |
                        v
                 [Edge Function: datamind-execute]
                        |
                        v
                 [E2B Sandbox]
                 (executa Python)
                        |
                        v
                 [Resultado: texto/imagem]
                        |
                        v
                 [Chat: renderiza output]
```

## Mudanças no Banco de Dados

### Novas tabelas
1. **`datamind_conversations`**: id, user_id, title, created_at, updated_at
2. **`datamind_messages`**: id, conversation_id, role (user/assistant), content, code_block, output_type (text/image/table), output_content, created_at
3. **`datamind_files`**: id, conversation_id, user_id, file_name, file_path, file_size, schema_info (jsonb com colunas/tipos), created_at

Todas com RLS para que usuários vejam apenas seus próprios dados.

## Implementação

### 1. Navegação e Rota
- Adicionar "DataMind" no `AppHeader.tsx` com ícone `BrainCircuit`
- Adicionar rota `/datamind` e `/datamind/:id` no `App.tsx`
- Adicionar tradução para `nav.datamind`

### 2. Página Principal (`src/pages/DataMind.tsx`)
Layout com duas áreas:
- **Sidebar esquerda**: Lista de conversas, botão "Novo Chat", perfil
- **Área central**: Chat estilo notebook

### 3. Componentes do Chat
- **`DataMindSidebar.tsx`**: Histórico de conversas com busca
- **`DataMindChat.tsx`**: Área principal de chat
- **`DataMindMessage.tsx`**: Renderiza mensagens com suporte a:
  - Markdown rico (react-markdown com suporte a tabelas)
  - Blocos de código Python com syntax highlighting
  - Imagens de gráficos
  - Tabelas de preview de dados
- **`DataMindInput.tsx`**: Input com botão de upload de arquivo e envio
- **`DataMindFilePreview.tsx`**: Card mostrando preview do CSV (primeiras 5 linhas)
- **`DataMindCodeOutput.tsx`**: Renderiza output de execução (texto, gráfico, tabela)

### 4. Edge Functions

#### `datamind-chat` (gera código Python)
- Recebe: mensagem do usuário, histórico, schema do arquivo
- Envia para Lovable AI Gateway com system prompt especializado em análise de dados
- Retorna: explicação + código Python

#### `datamind-execute` (executa código Python)
- Recebe: código Python, ID do arquivo
- Baixa arquivo do Supabase Storage
- Cria sandbox E2B, instala pandas/matplotlib/seaborn
- Executa o código
- Se houver imagem gerada, salva no Supabase Storage
- Retorna: output texto + URL da imagem (se houver)

#### `datamind-analyze-schema` (analisa esquema do arquivo)
- Recebe: arquivo upado
- Executa `df.info()` e `df.describe()` via E2B
- Retorna: colunas, tipos, estatísticas básicas

### 5. Upload de Arquivos
- Aceita .csv e .xlsx
- Salva no bucket `datamind-files` do Supabase Storage
- Após upload, chama `datamind-analyze-schema` para extrair metadados
- Exibe preview com primeiras 5 linhas em tabela shadcn/ui

### 6. Visualização de Gráficos
- Gráficos gerados pelo Python (matplotlib/seaborn) salvos como PNG no Storage
- Renderizados inline no chat como imagens
- Opção de gráficos interativos via Recharts quando apropriado

### 7. Design Visual
- Tema escuro elegante com acentos em azul/roxo
- Fonte moderna, espaçamento generoso
- Cards arredondados para mensagens
- Transições suaves com framer-motion

## Arquivos a Criar/Modificar

### Novos arquivos:
- `src/pages/DataMind.tsx` - Página principal
- `src/components/datamind/DataMindSidebar.tsx` - Sidebar de conversas
- `src/components/datamind/DataMindChat.tsx` - Área de chat
- `src/components/datamind/DataMindMessage.tsx` - Componente de mensagem
- `src/components/datamind/DataMindInput.tsx` - Input com upload
- `src/components/datamind/DataMindFilePreview.tsx` - Preview de arquivo
- `src/components/datamind/DataMindCodeOutput.tsx` - Output de execução
- `supabase/functions/datamind-chat/index.ts` - Edge function de chat IA
- `supabase/functions/datamind-execute/index.ts` - Edge function de execução Python
- `supabase/functions/datamind-analyze-schema/index.ts` - Análise de schema

### Arquivos a modificar:
- `src/App.tsx` - Adicionar rotas
- `src/components/app/AppHeader.tsx` - Adicionar link DataMind
- `src/i18n/translations.ts` - Adicionar traduções
- `supabase/config.toml` - Registrar novas edge functions

### Migração SQL:
- Criar tabelas `datamind_conversations`, `datamind_messages`, `datamind_files`
- Criar bucket de storage `datamind-files`
- Aplicar RLS policies

