
# Integracão Google Sheets + Download Excel no DataMind

## Visao Geral
Adicionar dois botoes de exportacao em cada tabela e grafico gerado pelo DataMind:
1. **Download Excel (.xlsx)** - gera o arquivo localmente no navegador
2. **Enviar para Google Sheets** - cria uma planilha no Google Drive do usuario

---

## Parte 1: Download como Excel (.xlsx)

**Abordagem:** Usar a biblioteca `xlsx` (SheetJS) para gerar arquivos .xlsx diretamente no navegador, sem necessidade de servidor.

- Instalar dependencia `xlsx`
- Adicionar botao "Download Excel" ao lado do botao CSV existente em cada tabela (`DataMindCodeOutput.tsx`)
- Para graficos, manter o download PNG existente

---

## Parte 2: Enviar para Google Sheets

**Abordagem:** Usar Google OAuth (login com Google via Supabase Auth) + Edge Function que chama a Google Sheets API com o token do usuario.

### Passo 1 - Configuracao Google OAuth no Supabase
- O usuario precisa configurar o Google OAuth Provider no dashboard do Supabase (Authentication > Providers > Google)
- Adicionar o scope `https://www.googleapis.com/auth/spreadsheets` para permitir criacao de planilhas
- Adicionar o scope `https://www.googleapis.com/auth/drive.file` para salvar no Drive

### Passo 2 - Edge Function `export-to-sheets`
- Criar `supabase/functions/export-to-sheets/index.ts`
- Recebe: dados da tabela (headers + rows) ou URL da imagem do grafico
- Usa o token OAuth do Google do usuario (extraido do provider_token do Supabase Auth)
- Chama a Google Sheets API para:
  - Criar nova planilha
  - Popular com os dados
  - Para graficos: insere a imagem na planilha
- Retorna o link da planilha criada

### Passo 3 - Botao na interface
- Adicionar botao com icone do Google Sheets em cada tabela e grafico no `DataMindCodeOutput.tsx`
- Ao clicar:
  - Verifica se o usuario esta logado com Google (tem provider_token)
  - Se nao, mostra toast pedindo para fazer login com Google
  - Se sim, chama a edge function e mostra o link da planilha criada
- Feedback visual: loading spinner durante envio, toast com link ao concluir

---

## Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| `package.json` | Adicionar dependencia `xlsx` |
| `src/components/datamind/DataMindCodeOutput.tsx` | Adicionar botoes Excel e Google Sheets |
| `supabase/functions/export-to-sheets/index.ts` | Nova edge function para Google Sheets API |
| `supabase/config.toml` | Registrar nova edge function |

---

## Pre-requisitos do usuario

Para o Google Sheets funcionar, o usuario precisara:
1. Configurar Google OAuth no Supabase Dashboard (criar credenciais no Google Cloud Console)
2. Adicionar os scopes de Sheets e Drive
3. Fazer login na aplicacao usando conta Google

O download Excel funcionara imediatamente sem nenhuma configuracao.

---

## Secao Tecnica

### Geracao Excel (client-side)
```typescript
import * as XLSX from 'xlsx';

function downloadExcel(headers: string[], rows: string[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, filename);
}
```

### Edge Function (export-to-sheets)
- Recebe `{ headers, rows, title }` no body
- Extrai `provider_token` do header Authorization via Supabase Auth
- POST para `https://sheets.googleapis.com/v4/spreadsheets` para criar planilha
- PUT para popular os dados
- Retorna `{ url: "https://docs.google.com/spreadsheets/d/..." }`
