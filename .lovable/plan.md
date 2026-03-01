

## Substituir E2B por Pyodide (Python gratis no navegador)

### Problema
O E2B cobra por minuto de sandbox (~$0.10/min), o que se torna caro com uso frequente. O Google Colab nao tem API publica oficial para execucao programatica.

### Solucao: Pyodide
**Pyodide** e um runtime Python compilado para WebAssembly que roda **100% no navegador do usuario**, sem nenhum custo de servidor. Suporta as principais bibliotecas de analise de dados:
- pandas, numpy, scipy, statsmodels, scikit-learn
- matplotlib (renderiza graficos como imagens base64 diretamente)
- openpyxl (leitura de Excel)

**Custo: R$ 0,00** -- todo o processamento acontece no dispositivo do usuario.

### Limitacoes do Pyodide vs E2B
- Arquivos muito grandes (>50MB) podem ser lentos no navegador
- Algumas bibliotecas C nativas nao estao disponiveis (ex: TensorFlow)
- Depende do hardware do usuario

### Plano de alteracoes

**1. Criar hook `src/hooks/usePyodide.ts`**
- Carrega o Pyodide via CDN (lazy, apenas quando necessario)
- Gerencia o estado do runtime (loading, ready, error)
- Expoe funcao `runPython(code, files)` que retorna stdout + imagens
- Instala micropip + pacotes necessarios na primeira execucao
- Mantem a instancia entre mensagens (persistencia de variaveis)

**2. Criar worker `public/pyodide-worker.js`**
- Web Worker para executar Python sem bloquear a UI
- Comunicacao via postMessage
- Carrega arquivos no filesystem virtual do Pyodide (MEMFS)
- Captura stdout/stderr e imagens matplotlib via base64

**3. Atualizar `src/pages/DataMind.tsx`**
- Substituir chamada a edge function `datamind-execute` pelo hook `usePyodide`
- Manter o fluxo: arquivo vai para Supabase Storage e tambem e carregado no Pyodide
- Graficos gerados ficam em base64 (sem necessidade de upload ao Storage)

**4. Atualizar `src/components/datamind/DataMindSandboxPanel.tsx`**
- Mostrar status real do Pyodide (Carregando / Pronto / Erro)
- Exibir uso de memoria estimado do navegador
- Reset real: recriar instancia do Pyodide

**5. Manter a edge function como fallback (opcional)**
- A edge function `datamind-execute` pode ser mantida para casos de arquivos muito grandes
- Adicionar toggle na UI: "Executar no navegador" vs "Executar na nuvem (E2B)"

### Fluxo tecnico

```text
1. Usuario envia arquivo + pergunta
2. IA gera codigo Python (via datamind-chat, sem mudanca)
3. Frontend recebe o codigo
4. usePyodide.runPython(code):
   a. Carrega arquivo no filesystem virtual (pyodide.FS)
   b. Injeta bootstrap (import pandas, df = pd.read_csv(...))
   c. Executa codigo no Web Worker
   d. Captura stdout + imagens matplotlib (base64)
5. Resultado exibido no chat (texto + graficos inline)
```

### Dependencias
- Pyodide CDN (nenhum pacote npm necessario, carregado via script)
- Nenhuma nova edge function necessaria
- Nenhuma alteracao no banco de dados

