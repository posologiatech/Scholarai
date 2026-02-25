
# Gerador de Ilustracoes Cientificas via IA

## Resumo

Criar uma pagina onde o usuario descreve em texto o diagrama cientifico desejado (ex: "Crie um diagrama mostrando a infeccao por SARS-CoV-2 na celula hospedeira") e a IA gera a imagem automaticamente. O usuario pode salvar, baixar e regenerar.

## Componentes a criar

### 1. Edge Function: `generate-illustration`

- Recebe o prompt do usuario em texto
- Envia para o Lovable AI Gateway usando o modelo `google/gemini-3-pro-image-preview` (melhor qualidade de imagem)
- O prompt de sistema instrui a IA a gerar ilustracoes cientificas precisas, com estilo limpo e profissional (inspirado no BioRender)
- Retorna a imagem em base64
- Faz upload automatico da imagem para um bucket Supabase Storage (`illustrations`)
- Salva os metadados em uma tabela `illustrations`
- Trata erros 429 (rate limit) e 402 (creditos)

### 2. Migracao SQL

**Nova tabela `illustrations`:**
- id (UUID)
- user_id (UUID, referencia auth.users)
- prompt (TEXT) - o texto que o usuario digitou
- image_url (TEXT) - URL publica no Storage
- created_at (TIMESTAMPTZ)

**Novo bucket Storage `illustrations`** (publico, para exibir imagens)

**RLS:**
- SELECT: usuarios autenticados veem apenas suas proprias ilustracoes
- INSERT: via service_role na Edge Function

### 3. Pagina: `src/pages/Illustrations.tsx`

- Campo de texto (textarea) para o usuario descrever o diagrama
- Botao "Gerar Ilustracao"
- Estado de loading com animacao
- Exibicao da imagem gerada
- Botoes: "Baixar PNG", "Regenerar", "Salvar na Biblioteca"
- Galeria abaixo com ilustracoes anteriores do usuario (grid de cards)
- Cada card mostra: miniatura, prompt usado, data, botao de download e deletar

### 4. Navegacao

- Adicionar link "Ilustracoes" no AppHeader com icone `Palette` (lucide)
- Adicionar rota `/illustrations` em App.tsx (protegida)

## Detalhamento Tecnico

### Edge Function `generate-illustration`

```text
1. Recebe { prompt } do frontend
2. Monta mensagem com system prompt cientifico + prompt do usuario
3. Chama Lovable AI Gateway com modelo google/gemini-3-pro-image-preview
4. Extrai base64 da resposta (choices[0].message.images[0].image_url.url)
5. Converte base64 para Uint8Array
6. Faz upload para Supabase Storage (illustrations/{user_id}/{uuid}.png)
7. Obtem URL publica
8. Insere registro na tabela illustrations
9. Retorna { image_url, id } ao frontend
```

### System Prompt para geracao

O prompt instrui o modelo a gerar ilustracoes cientificas com:
- Estilo limpo, profissional, fundo branco
- Rotulos e legendas claros
- Precisao anatomica/molecular
- Sem texto ambiguo ou erros cientificos
- Estilo vetorial flat (inspirado no BioRender)

### Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| Nova migracao SQL | Tabela illustrations + bucket + RLS |
| `supabase/functions/generate-illustration/index.ts` | Nova Edge Function |
| `supabase/config.toml` | Adicionar config da funcao |
| `src/pages/Illustrations.tsx` | Nova pagina |
| `src/App.tsx` | Adicionar rota /illustrations |
| `src/components/app/AppHeader.tsx` | Adicionar link de navegacao |
| `src/i18n/translations.ts` | Adicionar traducoes |

### Sequencia de implementacao

1. Migracao SQL (tabela + bucket)
2. Edge Function generate-illustration
3. Pagina Illustrations.tsx
4. Navegacao (App.tsx + AppHeader)
5. Deploy da Edge Function
