// Compact colormap definitions. Each returns [r,g,b] in 0-255 for t in [0,1].
export type ColormapName = "jet" | "viridis" | "plasma" | "inferno" | "magma" | "turbo" | "redgreen";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

const sampleStops = (stops: [number, [number, number, number]][], t: number): [number, number, number] => {
  t = clamp01(t);
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const k = (t - t0) / (t1 - t0 || 1);
      return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)];
    }
  }
  return stops[stops.length - 1][1];
};

// Stops approximate well-known matplotlib palettes
const STOPS: Record<ColormapName, [number, [number, number, number]][]> = {
  jet: [
    [0.0, [0, 0, 143]],
    [0.125, [0, 0, 255]],
    [0.375, [0, 255, 255]],
    [0.625, [255, 255, 0]],
    [0.875, [255, 0, 0]],
    [1.0, [128, 0, 0]],
  ],
  viridis: [
    [0.0, [68, 1, 84]],
    [0.25, [59, 82, 139]],
    [0.5, [33, 144, 141]],
    [0.75, [93, 201, 99]],
    [1.0, [253, 231, 37]],
  ],
  plasma: [
    [0.0, [13, 8, 135]],
    [0.25, [126, 3, 168]],
    [0.5, [204, 71, 120]],
    [0.75, [248, 149, 64]],
    [1.0, [240, 249, 33]],
  ],
  inferno: [
    [0.0, [0, 0, 4]],
    [0.25, [87, 16, 110]],
    [0.5, [187, 55, 84]],
    [0.75, [249, 142, 9]],
    [1.0, [252, 255, 164]],
  ],
  magma: [
    [0.0, [0, 0, 4]],
    [0.25, [80, 18, 123]],
    [0.5, [183, 55, 121]],
    [0.75, [251, 136, 97]],
    [1.0, [252, 253, 191]],
  ],
  turbo: [
    [0.0, [48, 18, 59]],
    [0.2, [70, 117, 237]],
    [0.4, [27, 209, 168]],
    [0.6, [156, 234, 56]],
    [0.8, [253, 156, 49]],
    [1.0, [122, 4, 3]],
  ],
  // Mimics the classic red-yellow-green palette used in the user's reference image
  redgreen: [
    [0.0, [0, 100, 0]],
    [0.35, [120, 200, 80]],
    [0.55, [255, 255, 0]],
    [0.75, [255, 165, 0]],
    [1.0, [200, 0, 0]],
  ],
};

export const sampleColormap = (name: ColormapName, t: number) => sampleStops(STOPS[name], t);

export const COLORMAPS: { name: ColormapName; label: string }[] = [
  { name: "redgreen", label: "Verde → Vermelho (clássico)" },
  { name: "jet", label: "Jet" },
  { name: "viridis", label: "Viridis" },
  { name: "plasma", label: "Plasma" },
  { name: "inferno", label: "Inferno" },
  { name: "magma", label: "Magma" },
  { name: "turbo", label: "Turbo" },
];
