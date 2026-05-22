// Edge function: refine a generated heatmap PNG with Lovable AI image model
// Optional final pass to clean labels, improve contrast, add subtle polish.
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { image, title, unit } = await req.json();
    if (!image || typeof image !== "string") {
      return json({ error: "image required (data URL)" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const prompt = [
      "You are a scientific cartography editor.",
      "Refine this generated heatmap into a publication-quality figure.",
      "Preserve the exact spatial distribution of colors (do not move or invent data).",
      "Improve typography, sharpen the legend, and ensure clean white background outside the figure.",
      title ? `Keep title: "${title}".` : "",
      unit ? `Legend unit: ${unit}.` : "",
      "Do not add fictional elements, watermarks, or stock decorations.",
    ].filter(Boolean).join(" ");

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
              { type: "image_url", image_url: { url: image } },
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
