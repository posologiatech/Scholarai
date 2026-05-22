# Heatmap Overlay — DataMind

Nova funcionalidade no DataMind para gerar **mapas de calor profissionais** combinando uma imagem base (mapa, foto aérea, planta arquitetônica, corpo humano, circuito, qualquer figura) com uma coluna numérica de uma planilha. Saída com qualidade de publicação: gradiente calibrado, legenda, escala, título e crédito.

## Fluxo do usuário

1. No chat do DataMind, usuário clica em **"Mapa de Calor sobre Imagem"** (novo botão no `DataMindInput`/toolbar) ou digita um pedido em linguagem natural ("gere um heatmap dessa imagem usando a coluna temperatura").
2. Abre um diálogo (`HeatmapOverlayDialog`) com 3 passos:
   - **Passo 1 — Imagem base**: upload (PNG/JPG) ou seleção de imagem já no chat. Preview à direita.
   - **Passo 2 — Dados**: escolher a planilha já carregada (ou subir nova) e selecionar:
     - Coluna de **valor** (numérica, obrigatória) — intensidade do calor.
     - Modo de **posicionamento** (radio):
       - `Coordenadas X,Y` — escolher 2 colunas (pixels ou normalizadas 0-1).
       - `Lat/Lon` — escolher colunas; precisa de bounding box (4 inputs) ou auto-detectar se a imagem tiver georreferência embutida.
       - `Grade/Região nomeada` — coluna de rótulo (ex.: "Área 1", "Bairro X") + o usuário clica na imagem para marcar o centro de cada rótulo (mini-anotador).
   - **Passo 3 — Estilo**: paleta (Viridis, Plasma, Jet/clássico vermelho-verde como o exemplo, Cividis, custom 2-cor), opacidade da sobreposição, raio do kernel, suavização (gaussian blur), discretização (contínua ou em N faixas tipo a legenda do exemplo), título, unidade (°C, %, etc.), legenda visível, exibir norte/escala, projeção (apenas informativa).
3. Clica **Gerar**. Backend produz PNG de alta resolução + retorna para o chat como mensagem com download, "Refazer com ajustes" e "Pinar no dashboard".

## Arquitetura técnica

```text
Cliente (React)                    Edge Function                 Execução
─────────────────                  ─────────────────             ──────────
HeatmapOverlayDialog  ──upload──▶  generate-heatmap-overlay  ──▶ Python (matplotlib
  (3 steps, preview)                 - valida payload              + scipy + PIL)
                                     - chama runner Python         no datamind-execute
                                     - persiste resultado          (Pyodide sandbox)
                                       em Storage bucket           ou Deno+ImageScript
                                                                   para versão server-side
```

Duas opções de execução — escolho a **server-side** por qualidade:

- **Edge Function `generate-heatmap-overlay`** (Deno) recebe `{image_url, points:[{x,y,value}], style}`, gera o overlay com uma rotina Python rodada via subprocess do runner já existente (`datamind-execute` usa Pyodide no browser). Para qualidade de pôster, criaremos um **runner Python no Edge** via `python-shell` não é possível; portanto:
  - **Opção A (escolhida)**: rodar o Python no **Pyodide já existente no cliente** (`public/pyodide-worker.js`) com matplotlib — mesma stack do DataMind. Sem custo de servidor extra. Saída como PNG base64.
  - **Opção B (fallback)**: chamar a AI Gateway com Nano Banana Pro (`google/gemini-3-pro-image-preview`) passando a imagem base + um PNG só com os pontos coloridos (gerado no cliente) e instruindo a IA a "compor um heatmap profissional sobre a imagem". Usada apenas se o usuário marcar **"Aprimorar com IA"**.

A primeira entrega faz **A** e oferece **B** como toggle opcional ("Refinar com IA").

### Algoritmo (Pyodide / matplotlib)

```python
# pseudo
img = PIL.Image.open(base).convert("RGBA")
H, W = img.size[::-1]
grid = np.zeros((H, W))
for x, y, v in points:
    grid += v * gaussian_kernel(center=(x,y), sigma=radius)
grid = normalize(grid)
cmap = matplotlib.cm.get_cmap(palette)
heat_rgba = cmap(grid)
heat_rgba[...,3] = alpha * mask_where_data
out = alpha_composite(img, heat_rgba)
# adiciona título, colorbar discretizado, escala, norte via matplotlib
```

### Reuso de componentes existentes

- `DataMindSpreadsheet` para escolher colunas.
- `DataMindFilePreview` para preview da imagem base.
- `IllustrationAnnotator` (já existe) para o modo "Grade/Região nomeada" — clicar e marcar pontos.
- Toast/usage tracker via `_shared/usage-tracker.ts`.

## Arquivos

Novos:
- `src/components/datamind/HeatmapOverlayDialog.tsx` — wizard 3 passos.
- `src/components/datamind/HeatmapStyleControls.tsx` — paleta, opacidade, raio, faixas.
- `src/components/datamind/HeatmapPointPicker.tsx` — anotador para modo região.
- `src/lib/heatmap/generateHeatmap.ts` — orquestra Pyodide worker, retorna blob PNG.
- `public/pyodide-heatmap.py` — script Python carregado pelo worker.
- `supabase/functions/refine-heatmap-ai/index.ts` — chamada opcional ao Nano Banana Pro (apenas se "Refinar com IA").

Editados:
- `src/components/datamind/DataMindInput.tsx` — botão "Mapa de Calor sobre Imagem".
- `src/components/datamind/DataMindChat.tsx` — render do resultado (imagem + ações).
- `src/pages/DataMind.tsx` — registra abertura do diálogo e injeta o resultado como mensagem.
- `public/pyodide-worker.js` — suportar comando `heatmap_overlay`.

Sem migração de banco. O PNG resultante usa o bucket `datamind-files` já existente (RLS por pasta `auth.uid()`).

## Casos cobertos pela exigência "qualquer imagem"

- Mapas geográficos (como o anexo) — modo Lat/Lon com bounding box.
- Plantas/CAD, raio-X, mapas corporais, circuitos — modo X,Y em pixels.
- Imagens com regiões nomeadas (bairros, departamentos, órgãos) — modo Região com picker manual.

## Rigor científico (memória do projeto)

- Sem fabricação: se faltarem coordenadas, dialog bloqueia geração e mostra "Dados insuficientes".
- Legenda sempre exibe a unidade e a fonte da coluna escolhida.
- Saída inclui rodapé: "Gerado por DataMind · base: <arquivo> · dados: <coluna> (n=<N>)".

## Fora do escopo desta entrega

- Animação temporal (séries de heatmaps por data).
- Georreferenciamento automático via OCR de coordenadas na imagem.
- Edição vetorial pós-geração.