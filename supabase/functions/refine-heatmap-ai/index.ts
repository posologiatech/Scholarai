// Edge function: AI heatmap generation/refinement using Google Gemini image generation
// Modes:
//   - "refine"     : polish an already-generated heatmap PNG (typography, legend)
//   - "full_fill"  : recolor the ENTIRE shape/region of a base image as a full-coverage
//                    choropleth/heatmap from a table of (label, value) pairs.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGoogleApiKey, generateGoogleImage } from "../_shared/google-image.ts";

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

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const googleApiKey = await getGoogleApiKey(serviceClient);
    if (!googleApiKey) {
      return json({ error: "Configure uma chave de API do Google AI em Configurações → API Keys para gerar heatmaps." }, 500);
    }

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

    let imgUrl: string;
    try {
      imgUrl = await generateGoogleImage({
        apiKey: googleApiKey,
        model: "gemini-2.5-flash-image",
        textPrompt: prompt,
        imageUrls: [imageDataUrl],
      });
    } catch (err: any) {
      if (err.status === 429) return json({ error: "Limite de uso atingido. Tente novamente em instantes." }, 429);
      if (err.status === 402 || err.status === 403) return json({ error: "Cota ou permissão da API do Google AI esgotada." }, 402);
      return json({ error: `Erro na API do Google AI: ${err.message}` }, 502);
    }

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
