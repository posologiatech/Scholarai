import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { requireAuth } from "../_shared/auth.ts";
import { callAI } from "../_shared/ai-caller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Encode ArrayBuffer to base64 without btoa (handles large files)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 32768;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { storagePath } = await req.json();
    if (!storagePath || typeof storagePath !== "string") {
      return new Response(JSON.stringify({ error: "storagePath is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The bucket's own RLS already scopes uploads to the caller's folder, but this
    // function reads via the service role (to bypass RLS for the download), so we
    // re-check ownership here defensively before touching storage.
    if (storagePath.split("/")[0] !== auth.userId) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("papers")
      .download(storagePath);
    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download PDF from storage" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const fileSizeMB = arrayBuffer.byteLength / (1024 * 1024);
    if (fileSizeMB > 15) {
      return new Response(JSON.stringify({ error: "PDF too large. Maximum 15MB supported." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const base64 = arrayBufferToBase64(arrayBuffer);

    const aiResponse = await callAI({
      _userId: auth.userId,
      _promptType: "library_pdf_metadata",
      model: "google/gemini-2.5-flash",
      _skipProviders: ["groq", "openai"],
      messages: [
        {
          role: "system",
          content:
            "You are a bibliographic metadata extractor. Read the provided PDF and identify its title, authors, publication year, journal/venue, DOI (if present), and abstract. Use empty string / empty array for anything you cannot find — never invent data.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the bibliographic metadata for this document." },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_paper_metadata",
            description: "Return the paper's bibliographic metadata",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                authors: { type: "array", items: { type: "string" } },
                year: { type: "string", description: "4-digit publication year, or empty string if unknown" },
                journal: { type: "string", description: "Journal or venue name, empty string if unknown" },
                doi: { type: "string", description: "DOI if present in the document, else empty string" },
                abstract: { type: "string", description: "The paper's abstract, empty string if none found" },
              },
              required: ["title", "authors"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_paper_metadata" } },
    } as any);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[import-pdf-to-library] AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Failed to extract metadata from PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No metadata returned" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    const yearNum = parseInt(extracted.year, 10);

    const { data: signedUrlData } = await supabase.storage
      .from("papers")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    const paper = {
      title: extracted.title || storagePath.split("/").pop()?.replace(/\.pdf$/i, "") || "Untitled",
      authors: Array.isArray(extracted.authors) ? extracted.authors.filter(Boolean) : [],
      year: Number.isFinite(yearNum) ? yearNum : null,
      doi: extracted.doi || null,
      journal: extracted.journal || null,
      abstract: extracted.abstract || null,
      url: signedUrlData?.signedUrl || null,
      source: "pdf_upload",
      pdf_path: storagePath,
    };

    return new Response(JSON.stringify({ paper }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[import-pdf-to-library] error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
