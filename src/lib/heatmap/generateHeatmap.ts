import { ColormapName, sampleColormap } from "./colormaps";

export interface HeatmapPoint {
  x: number; // in pixels (image coordinate system)
  y: number;
  value: number;
}

export interface HeatmapStyle {
  colormap: ColormapName;
  opacity: number; // 0-1, overall overlay opacity
  radius: number; // gaussian sigma in pixels
  bins: number; // 0 = continuous, >=2 = discrete steps (like reference image)
  showLegend: boolean;
  title: string;
  unit: string;
  footer: string;
  vmin?: number;
  vmax?: number;
}

export interface GenerateOptions {
  baseImage: HTMLImageElement;
  points: HeatmapPoint[];
  style: HeatmapStyle;
}

/**
 * Renders a publication-quality heatmap overlay onto a base image.
 * Uses a Gaussian-weighted accumulation (KDE-like) on a downsampled grid for speed,
 * then upsamples and composites with discretized colormap + side legend + title.
 */
export async function generateHeatmap(opts: GenerateOptions): Promise<Blob> {
  const { baseImage, points, style } = opts;
  const W = baseImage.naturalWidth;
  const H = baseImage.naturalHeight;

  // 1) Compute KDE grid (downsampled for performance)
  const scale = Math.max(1, Math.round(Math.max(W, H) / 600));
  const gw = Math.max(2, Math.floor(W / scale));
  const gh = Math.max(2, Math.floor(H / scale));
  const sigma = Math.max(1, style.radius / scale);
  const radius = Math.ceil(sigma * 3);

  const num = new Float32Array(gw * gh);
  const den = new Float32Array(gw * gh);

  const inv2s2 = 1 / (2 * sigma * sigma);
  for (const p of points) {
    if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.value)) continue;
    const cx = p.x / scale;
    const cy = p.y / scale;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(gw - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(gh - 1, Math.ceil(cy + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const w = Math.exp(-(dx * dx + dy * dy) * inv2s2);
        const i = y * gw + x;
        num[i] += w * p.value;
        den[i] += w;
      }
    }
  }

  // weighted-mean value per cell + alpha based on density (so empty zones stay transparent)
  const valueGrid = new Float32Array(gw * gh);
  const alphaGrid = new Float32Array(gw * gh);
  let dmax = 0;
  for (let i = 0; i < den.length; i++) if (den[i] > dmax) dmax = den[i];
  for (let i = 0; i < num.length; i++) {
    valueGrid[i] = den[i] > 0 ? num[i] / den[i] : NaN;
    alphaGrid[i] = dmax > 0 ? Math.min(1, den[i] / (dmax * 0.25)) : 0;
  }

  // 2) Normalize values
  const values = points.map((p) => p.value).filter((v) => isFinite(v));
  const vmin = style.vmin ?? Math.min(...values);
  const vmax = style.vmax ?? Math.max(...values);
  const range = vmax - vmin || 1;

  // 3) Build a layout: image + legend + title
  const legendW = style.showLegend ? 180 : 0;
  const titleH = style.title ? 60 : 20;
  const footerH = style.footer ? 36 : 16;
  const padding = 30;
  const canvasW = W + legendW + padding * 2;
  const canvasH = H + titleH + footerH + padding;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Title
  if (style.title) {
    ctx.fillStyle = "#0a0a0a";
    ctx.font = "bold 26px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(style.title, padding + W / 2, padding + 28);
  }

  // 4) Draw base image
  const imgX = padding;
  const imgY = titleH;
  ctx.drawImage(baseImage, imgX, imgY, W, H);

  // 5) Build heatmap RGBA from grid, then upscale
  const heatCanvas = document.createElement("canvas");
  heatCanvas.width = gw;
  heatCanvas.height = gh;
  const hctx = heatCanvas.getContext("2d")!;
  const imgData = hctx.createImageData(gw, gh);

  for (let i = 0; i < valueGrid.length; i++) {
    const v = valueGrid[i];
    const a = alphaGrid[i];
    if (!isFinite(v) || a <= 0.01) {
      imgData.data[i * 4 + 3] = 0;
      continue;
    }
    let t = (v - vmin) / range;
    if (style.bins >= 2) t = Math.round(t * (style.bins - 1)) / (style.bins - 1);
    const [r, g, b] = sampleColormap(style.colormap, t);
    imgData.data[i * 4 + 0] = r;
    imgData.data[i * 4 + 1] = g;
    imgData.data[i * 4 + 2] = b;
    imgData.data[i * 4 + 3] = Math.round(a * style.opacity * 255);
  }
  hctx.putImageData(imgData, 0, 0);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(heatCanvas, imgX, imgY, W, H);

  // Image border
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(imgX, imgY, W, H);

  // 6) Legend (vertical color bar)
  if (style.showLegend) {
    const lx = imgX + W + padding;
    const ly = imgY + 10;
    const lw = 28;
    const lh = Math.min(H - 20, 360);

    // Draw gradient
    const steps = style.bins >= 2 ? style.bins : 128;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const [r, g, b] = sampleColormap(style.colormap, t);
      ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      const y = ly + lh - (i + 1) * (lh / steps);
      ctx.fillRect(lx, y, lw, lh / steps + 0.5);
    }
    ctx.strokeStyle = "#0a0a0a";
    ctx.lineWidth = 1;
    ctx.strokeRect(lx, ly, lw, lh);

    // Tick labels
    ctx.fillStyle = "#0a0a0a";
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const ticks = style.bins >= 2 ? style.bins + 1 : 5;
    for (let i = 0; i < ticks; i++) {
      const t = i / (ticks - 1);
      const val = vmin + t * range;
      const y = ly + lh - t * lh;
      ctx.beginPath();
      ctx.moveTo(lx + lw, y);
      ctx.lineTo(lx + lw + 4, y);
      ctx.stroke();
      ctx.fillText(formatNum(val) + (style.unit ? " " + style.unit : ""), lx + lw + 8, y);
    }

    // Legend title
    ctx.font = "bold 12px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Legenda" + (style.unit ? ` (${style.unit})` : ""), lx + lw / 2, ly - 14);
  }

  // 7) Footer
  if (style.footer) {
    ctx.fillStyle = "#525252";
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(style.footer, padding, canvasH - 14);
  }

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
  );
}

function formatNum(v: number): string {
  if (!isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

// --- Coordinate mappers ---

export function mapLatLonToPixels(
  lat: number,
  lon: number,
  bbox: { north: number; south: number; east: number; west: number },
  imgW: number,
  imgH: number
): { x: number; y: number } | null {
  const { north, south, east, west } = bbox;
  if (north === south || east === west) return null;
  const x = ((lon - west) / (east - west)) * imgW;
  const y = ((north - lat) / (north - south)) * imgH;
  return { x, y };
}
