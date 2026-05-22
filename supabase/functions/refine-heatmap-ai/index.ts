// Edge function: AI heatmap generation/refinement using Lovable AI (Gemini image)
// Modes:
//   - "refine"     : polish an already-generated heatmap PNG (typography, legend)
//   - "full_fill"  : recolor the ENTIRE shape/region of a base image as a full-coverage
//                    choropleth/heatmap from a table of (label, value) pairs.
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PALETTE_DESC: Record<string, string> = {
  redgreen: "diverging palette from deep green (low) → yellow (mid) → orange → deep red (high), like the classic ecology/heat-island palette",
  jet: "classic jet palette: dark blue (low) → cyan → yellow → red (high)",
  viridis: "perceptually-uniform viridis: dark purple (low) → teal → yellow-green (high)",
  plasma: "plasma palette: dark purple → magenta → orange → yellow",
  inferno: "inferno palette: black → purple → orange → pale yellow",
  magma: "magma palette: black → purple → pink → cream",
  turbo: "turbo palette: dark blue → cyan → green → yellow → orange → dark red",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const mode: "refine" | "full_fill" = body.mode || "refine";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    let prompt = "";
    let imageDataUrl = "";

    if (mode === "full_fill") {
      const { baseImage, dataPairs, colormap, title, unit, valueLabel, regionLabel } = body as {
        baseImage: string;
        dataPairs: Array<{ label: string; value: number }>;
        colormap?: string;
        title?: string;
        unit?: string;
        valueLabel?: string;
        regionLabel?: string;
      };
      if (!baseImage) return json({ error: "baseImage required" }, 400);
      if (!Array.isArray(dataPairs) || dataPairs.length === 0)
        return json({ error: "dataPairs required" }, 400);

      imageDataUrl = baseImage;
      const palette = PALETTE_DESC[colormap || "redgreen"] || PALETTE_DESC.redgreen;
      const values = dataPairs.map((d) => Number(d.value)).filter((v) => isFinite(v));
      const vmin = Math.min(...values);
      const vmax = Math.max(...values);

      // Keep payload reasonable
      const pairsText = dataPairs
        .slice(0, 250)
        .map((d) => `- ${d.label}: ${d.value}${unit ? " " + unit : ""}`)
        .join("\n");

      prompt = [
        "You are a professional scientific cartographer / data-visualization designer.",
        "TASK: Recreate the attached reference image as a FULL-COVERAGE heatmap / choropleth.",
        "Every part of the relevant subject (map polygons, anatomical region, floor plan, satellite area, etc.) MUST be filled with color — NOT just a few blurry dots.",
        "Use the reference ONLY for its shape, boundaries, and layout. Replace its original colors entirely.",
        "",
        `COLOR PALETTE: ${palette}.`,
        `DATA SCALE: minimum = ${vmin}${unit ? " " + unit : ""} → maximum = ${vmax}${unit ? " " + unit : ""}.`,
        "Map each labeled region/area to a color based on its value. Use smooth gradients between neighboring regions when natural (continuous fields like temperature), or solid per-region fills when regions are discrete polygons.",
        "",
        `DATA${regionLabel ? ` (${regionLabel} → ${valueLabel || "value"})` : ""}:`,
        pairsText,
        dataPairs.length > 250 ? `(+${dataPairs.length - 250} more rows omitted)` : "",
        "",
        "REQUIREMENTS:",
        "1. Fill the ENTIRE subject area with the palette — no empty/transparent zones inside the subject.",
        "2. Preserve original outlines, borders, labels of the geography/shape so the figure remains recognizable.",
        "3. Add a clean vertical color-bar legend on the right with numeric ticks and the unit.",
        title ? `4. Add the title at top: "${title}".` : "4. No title unless one is naturally present.",
        "5. White background outside the figure. Professional, publication-quality. Clean Inter/Helvetica typography.",
        "6. DO NOT invent data, watermarks, stock decorations, or extra unrelated elements.",
        "7. Output a single high-resolution PNG.",
      ].filter(Boolean).join("\n");
    } else {
      // refine mode (legacy)
      const { image, title, unit } = body;
      if (!image) return json({ error: "image required (data URL)" }, 400);
      imageDataUrl = image;
      prompt = [
        "You are a scientific cartography editor.",
        "Refine this generated heatmap into a publication-quality figure.",
        "Preserve the exact spatial distribution of colors (do not move or invent data).",
        "Improve typography, sharpen the legend, ensure clean white background outside the figure.",
        title ? `Keep title: "${title}".` : "",
        unit ? `Legend unit: ${unit}.` : "",
        "Do not add fictional elements, watermarks, or stock decorations.",
      ].filter(Boolean).join(" ");
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (resp.status === 429) return json({ error: "Limite de uso atingido. Tente novamente em instantes." }, 429);
    if (resp.status === 402) return json({ error: "Créditos esgotados. Adicione créditos no workspace." }, 402);
    if (!resp.ok) {
      const txt = await resp.text();
      return json({ error: `AI gateway error: ${txt}` }, 502);
    }

    const data = await resp.json();
    const imgUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imgUrl) return json({ error: "AI não retornou imagem" }, 502);

    return json({ image_url: imgUrl });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
