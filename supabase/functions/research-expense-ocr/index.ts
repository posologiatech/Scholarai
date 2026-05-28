import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { image_base64, image_url, mime_type = "image/jpeg" } = body ?? {};
    if (!image_base64 && !image_url) {
      return new Response(JSON.stringify({ error: "image_base64 or image_url required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const imagePart = image_base64
      ? { type: "image_url", image_url: { url: `data:${mime_type};base64,${image_base64}` } }
      : { type: "image_url", image_url: { url: image_url } };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prompt = `Você é um agente de classificação de notas fiscais de pesquisa.
Extraia da imagem da NF/recibo os seguintes campos em JSON estrito:
{
  "supplier": string,
  "cnpj": string|null,
  "invoice_number": string|null,
  "expense_date": "YYYY-MM-DD"|null,
  "amount": number,
  "currency": "BRL",
  "items": [{"description": string, "qty": number, "unit_price": number}],
  "suggested_rubrica": "custeio"|"capital"|"bolsa"|"diaria"|"passagem"|"servico_terceiros"|"outros",
  "raw_text": string
}
Use "outros" se não tiver certeza. Responda APENAS o JSON.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, imagePart] }],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: `AI gateway: ${aiRes.status}`, detail: t }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const text: string = aiJson?.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    let parsed: any = {};
    try { parsed = JSON.parse(match ? match[0] : text); } catch { parsed = { raw_text: text }; }

    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
