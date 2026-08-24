import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { trackUsage } from "../_shared/usage-tracker.ts";
import { checkPlanLimit, planLimitExceededResponse } from "../_shared/plan-limits.ts";
import { getGoogleApiKey, generateGoogleImage } from "../_shared/google-image.ts";
import { checkCostCeiling, notifyCostCeilingBreach, logFlatCost } from "../_shared/ai-caller.ts";

// Gemini 3 Pro Image (1K/2K output) -- https://ai.google.dev/gemini-api/docs/pricing
const COST_PER_IMAGE_USD = 0.134;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STYLE_PROMPTS: Record<string, string> = {
  biorender: "Clean flat-vector aesthetic, BioRender style, white background, professional color palette, clear labels, modern minimalist, publication-ready.",
  textbook: "Classic scientific textbook illustration style, detailed cross-hatching, educational labels with leader lines, muted earth-tone palette, hand-drawn feel.",
  "3d": "3D rendered scientific visualization, soft ambient occlusion lighting, subtle gradients, photorealistic materials, depth of field, studio lighting on white background.",
  watercolor: "Scientific watercolor illustration, soft transparent washes, delicate ink outlines, botanical-illustration inspired, elegant muted palette, artistic yet accurate.",
  minimal: "Ultra-minimalist line art, single-weight strokes, monochrome with one accent color, maximum whitespace, Bauhaus-inspired geometric simplification.",
  infographic: "Modern infographic style, bold flat colors, data-visualization aesthetic, icons and pictograms, clear visual hierarchy, magazine-quality layout.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    if (!(await checkPlanLimit(anonClient, userId, "illustrations"))) {
      return planLimitExceededResponse(corsHeaders, "illustrations");
    }

    if (!(await checkCostCeiling(userId))) {
      notifyCostCeilingBreach(userId).catch(() => {});
      return new Response(JSON.stringify({
        error: "cost_ceiling_exceeded",
        message: "Você atingiu o teto de custo de IA do seu plano para este mês. Ele será renovado no próximo período, ou entre em contato com o suporte.",
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { prompt, style, existingImageUrl, editInstruction, paperContext, variations } = body;

    // Determine mode
    const isEdit = !!existingImageUrl && !!editInstruction;
    const isGraphicalAbstract = !!paperContext;
    const numVariations = variations ? Math.min(Number(variations), 3) : 1;

    if (!isEdit && !prompt && !isGraphicalAbstract) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const googleApiKey = await getGoogleApiKey(serviceClient);
    if (!googleApiKey) {
      return new Response(JSON.stringify({ error: "Configure uma chave de API do Google AI em Configurações → API Keys para gerar ilustrações." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedStyle = style && STYLE_PROMPTS[style] ? STYLE_PROMPTS[style] : STYLE_PROMPTS.biorender;

    let systemPrompt = `You are a professional scientific illustrator. Generate clean, precise scientific illustrations with these characteristics:
- ${selectedStyle}
- Anatomically and molecularly accurate representations
- No ambiguous text or scientific errors
- Include clear legends when appropriate
- Use consistent line weights and proportions`;

    // Build text prompt / reference image
    let textPrompt: string;
    let imageUrls: string[] | undefined;
    let savedPrompt: string;

    if (isEdit) {
      // AI Image Editing mode
      systemPrompt = `You are a professional scientific illustration editor. Apply the requested edit to the provided scientific illustration while maintaining its overall style, accuracy, and quality. ${selectedStyle}`;
      textPrompt = editInstruction;
      imageUrls = [existingImageUrl];
      savedPrompt = `[Edit] ${editInstruction}`;
    } else if (isGraphicalAbstract) {
      // Graphical abstract from paper
      const { title, abstract: paperAbstract } = paperContext;
      systemPrompt += `\n\nYou are creating a Graphical Abstract for a scientific paper. Create a visual summary that captures the key methodology, findings, and conclusions of the study. Use a clear left-to-right or top-to-bottom flow. Include icons representing methods, arrows showing process flow, and key result highlights.`;
      textPrompt = `Create a Graphical Abstract for this paper:\n\nTitle: ${title}\n\nAbstract: ${paperAbstract}${prompt ? `\n\nAdditional instructions: ${prompt}` : ""}`;
      savedPrompt = `[Graphical Abstract] ${title}`;
    } else {
      textPrompt = prompt;
      savedPrompt = prompt;
    }

    // Generate (possibly multiple variations)
    const generateOne = async () => {
      try {
        return await generateGoogleImage({
          apiKey: googleApiKey,
          model: "gemini-3-pro-image-preview",
          systemText: systemPrompt,
          textPrompt,
          imageUrls,
        });
      } catch (err: any) {
        if (err.status === 429) throw { status: 429, message: "Rate limit exceeded. Please try again." };
        if (err.status === 402 || err.status === 403) throw { status: 402, message: "Cota ou permissão da API do Google AI esgotada." };
        throw err;
      }
    };

    const uploadAndSave = async (base64Url: string, promptText: string) => {
      const base64Data = base64Url.replace(/^data:image\/\w+;base64,/, "");
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      const fileName = `${userId}/${crypto.randomUUID()}.png`;
      const { error: uploadError } = await serviceClient.storage.from("illustrations").upload(fileName, bytes, { contentType: "image/png", upsert: false });
      if (uploadError) { console.error("Upload error:", uploadError); throw new Error("Failed to upload image"); }

      const { data: urlData } = serviceClient.storage.from("illustrations").getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;

      const { data: insertData, error: insertError } = await serviceClient
        .from("illustrations").insert({ user_id: userId, prompt: promptText, image_url: imageUrl }).select("id").single();
      if (insertError) { console.error("Insert error:", insertError); throw new Error("Failed to save illustration metadata"); }

      return { id: insertData.id, image_url: imageUrl };
    };

    try {
      if (numVariations > 1) {
        // Generate variations in parallel
        const promises = Array.from({ length: numVariations }, () => generateOne());
        const base64Results = await Promise.all(promises);
        const results = [];
        for (let i = 0; i < base64Results.length; i++) {
          const result = await uploadAndSave(base64Results[i], `${savedPrompt} [Variation ${i + 1}]`);
          results.push(result);
        }
        trackUsage(userId, "illustrations", numVariations).catch(e => console.error("usage tracking error:", e));
        logFlatCost(userId, "google", "gemini-3-pro-image-preview", "illustration", COST_PER_IMAGE_USD * numVariations)
          .catch(e => console.error("cost logging error:", e));
        return new Response(JSON.stringify({ variations: results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const base64Url = await generateOne();
        const result = await uploadAndSave(base64Url, savedPrompt);
        trackUsage(userId, "illustrations").catch(e => console.error("usage tracking error:", e));
        logFlatCost(userId, "google", "gemini-3-pro-image-preview", "illustration", COST_PER_IMAGE_USD)
          .catch(e => console.error("cost logging error:", e));
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (err: any) {
      if (err.status === 429 || err.status === 402) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw err;
    }
  } catch (e) {
    console.error("generate-illustration error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
