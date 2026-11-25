/** Rasterises a standalone SVG (with a viewBox) to PNG bytes at 2x, on a white background. Browser only. */
export function svgToPngBytes(svg: string): Promise<{ png: Uint8Array; width: number; height: number }> {
  const m = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  const width = m ? Number(m[1]) : 700, height = m ? Number(m[2]) : 400, scale = 2;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale; canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas unavailable"));
      ctx.scale(scale, scale); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(async (b) => (b ? resolve({ png: new Uint8Array(await b.arrayBuffer()), width, height }) : reject(new Error("png failed"))), "image/png");
    };
    img.onerror = () => reject(new Error("svg could not be rendered"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}
