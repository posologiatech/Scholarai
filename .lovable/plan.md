

## Corrigir execucao de codigo Python no DataMind

### Problema
O erro "Erro ao executar codigo Python" ocorre porque a edge function `datamind-execute` usa endpoints REST da E2B que nao existem:
- URL base errada: `api.e2b.dev` (correto: `api.e2b.app`)
- Endpoint `/code/execution` nao existe na API REST da E2B
- Endpoint `/files` com JSON body nao e o formato correto para upload

A E2B requer o uso do SDK `@e2b/code-interpreter` para execucao de codigo e manipulacao de arquivos.

### Solucao
Reescrever a edge function `datamind-execute` usando o SDK oficial `@e2b/code-interpreter` via `npm:` specifier do Deno.

### Alteracoes

**1. Reescrever `supabase/functions/datamind-execute/index.ts`**
- Importar `Sandbox` de `npm:@e2b/code-interpreter`
- Usar `Sandbox.create()` para criar sandbox
- Usar `sandbox.files.write()` para upload do arquivo
- Usar `sandbox.runCode()` para executar Python
- Capturar resultados (stdout, stderr, charts/images)
- Manter logica de upload de graficos para Supabase Storage

```text
Fluxo corrigido:
1. Download arquivo do Supabase Storage
2. Sandbox.create() com apiKey
3. sandbox.files.write('/tmp/data.csv', fileBytes)
4. sandbox.runCode(pythonCode)
5. Se houver chart.png -> sandbox.files.read('/tmp/chart.png')
6. Upload chart para Supabase Storage
7. Retornar resultado (stdout + image_url)
8. sandbox.kill()
```

**2. Ajustar tratamento de erros**
- Adicionar logs detalhados do stderr para debugging
- Retornar mensagens de erro mais informativas ao usuario
- Incluir stderr no output quando houver falha

### Detalhes tecnicos

O SDK `@e2b/code-interpreter` e compativel com Deno via `npm:@e2b/code-interpreter`. A funcao `runCode()` retorna um objeto `Execution` com `logs.stdout`, `logs.stderr`, e `results` (que podem conter imagens base64). Isso elimina a necessidade de chamar endpoints REST manualmente.

