import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Split text into chunks of ~500 tokens (~2000 chars)
function chunkText(text: string, maxChars = 2000): string[] {
  if (!text || text.length <= maxChars) return [text].filter(Boolean);
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function generateAndSaveEmbeddings(
  paperId: string,
  paperTitle: string,
  text: string,
  apiKey: string,
  supabase: any
) {
  const chunks = chunkText(text);

  for (let i = 0; i < chunks.length; i++) {
    // Generate embedding via Lovable AI Gateway
    const embResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/text-embedding-004',
        input: chunks[i].slice(0, 8000),
      }),
    });

    if (!embResponse.ok) {
      console.error(`Embedding error for chunk ${i}:`, embResponse.status);
      continue;
    }

    const embData = await embResponse.json();
    const embedding = embData.data?.[0]?.embedding;
    if (!embedding) continue;

    await supabase.from('paper_chunks').insert({
      paper_id: paperId,
      paper_title: paperTitle,
      chunk_index: i,
      chunk_text: chunks[i],
      embedding: embedding,
      source: 'full_text',
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate user
  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { paper_id, columns, query, locale = "en" } = await req.json();

    if (!paper_id) {
      return new Response(
        JSON.stringify({ error: "paper_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify paper ownership using user's auth context (RLS enforced)
    const { data: ownedPaper, error: ownershipError } = await auth.supabase
      .from("uploaded_papers")
      .select("id")
      .eq("id", paper_id)
      .single();

    if (ownershipError || !ownedPaper) {
      return new Response(
        JSON.stringify({ error: "Paper not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for storage access (ownership already verified)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the paper record with service role
    const { data: paper, error: paperError } = await supabase
      .from("uploaded_papers")
      .select("*")
      .eq("id", paper_id)
      .single();

    if (paperError || !paper) {
      return new Response(
        JSON.stringify({ error: "Paper not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let textContent = paper.extracted_text;

    // If text not yet extracted, download PDF and extract via AI
    if (!textContent) {
      // Update status to processing
      await supabase
        .from("uploaded_papers")
        .update({ status: "processing" })
        .eq("id", paper_id);

      // Download PDF from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("papers")
        .download(paper.file_path);

      if (downloadError || !fileData) {
        await supabase
          .from("uploaded_papers")
          .update({ status: "error" })
          .eq("id", paper_id);
        return new Response(
          JSON.stringify({ error: "Failed to download PDF" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Convert PDF to base64 for Gemini vision
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      // Use Gemini to extract text from PDF
      const extractResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "You are a document text extraction assistant. Extract ALL text content from the provided PDF document. Preserve the structure including title, authors, abstract, sections, references. Output the full text faithfully.",
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract all the text from this PDF document. Preserve structure and formatting.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:application/pdf;base64,${base64}`,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!extractResponse.ok) {
        const errText = await extractResponse.text();
        console.error("Text extraction error:", extractResponse.status, errText);
        await supabase
          .from("uploaded_papers")
          .update({ status: "error" })
          .eq("id", paper_id);
        return new Response(
          JSON.stringify({ error: "Failed to extract text from PDF" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const extractData = await extractResponse.json();
      textContent =
        extractData.choices?.[0]?.message?.content || "No text extracted";

      // Try to extract title from the text
      const titleMatch = textContent.match(/^#?\s*(.+?)[\n\r]/);
      const extractedTitle = titleMatch ? titleMatch[1].trim().slice(0, 200) : paper.file_name.replace(/\.pdf$/i, "");

      // Save extracted text
      await supabase
        .from("uploaded_papers")
        .update({
          extracted_text: textContent,
          title: extractedTitle,
          status: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paper_id);

      // Generate embeddings in background for the extracted text
      try {
        await generateAndSaveEmbeddings(paper_id, extractedTitle, textContent, LOVABLE_API_KEY, supabase);
        console.log(`Embeddings generated for paper ${paper_id}`);
      } catch (embErr) {
        console.error(`Embedding generation failed for paper ${paper_id}:`, embErr);
        // Non-blocking: extraction still succeeds even if embeddings fail
      }
    } else {
      // Text already exists — check if embeddings exist, generate if not
      const { data: existingChunks } = await supabase
        .from('paper_chunks')
        .select('id')
        .eq('paper_id', paper_id)
        .limit(1);

      if (!existingChunks || existingChunks.length === 0) {
        try {
          const title = paper.title || paper.file_name.replace(/\.pdf$/i, "");
          await generateAndSaveEmbeddings(paper_id, title, textContent, LOVABLE_API_KEY, supabase);
          console.log(`Embeddings generated (existing text) for paper ${paper_id}`);
        } catch (embErr) {
          console.error(`Embedding generation failed for paper ${paper_id}:`, embErr);
        }
      }
    }

    // If columns are provided, extract structured data
    if (columns && Array.isArray(columns) && columns.length > 0 && query) {
      const columnNames = columns.map((c: any) => c.name).join(", ");
      const columnDetails = columns
        .map(
          (c: any) =>
            `- "${c.name}": ${c.prompt || c.description || c.name}`
        )
        .join("\n");

      const systemPrompt =
        locale === "pt"
          ? `Você é um assistente de extração de dados acadêmicos. Dado o texto completo de um artigo científico, extraia as informações solicitadas para cada coluna. Responda APENAS usando a função fornecida.`
          : `You are an academic data extraction assistant. Given the full text of a scientific paper, extract the requested information for each column. Respond ONLY using the provided function.`;

      const dataResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `Research question: "${query}"\n\nColumns to extract:\n${columnDetails}\n\nFull paper text:\n${textContent.slice(0, 30000)}`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "extract_paper_data",
                  description:
                    "Return extracted data for each column from the paper",
                  parameters: {
                    type: "object",
                    properties: {
                      extractions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            column_name: { type: "string" },
                            value: { type: "string" },
                          },
                          required: ["column_name", "value"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["extractions"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "extract_paper_data" },
            },
          }),
        }
      );

      if (!dataResponse.ok) {
        if (dataResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (dataResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required" }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errText = await dataResponse.text();
        console.error("Data extraction error:", dataResponse.status, errText);
        return new Response(
          JSON.stringify({ error: "AI extraction error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const dataResult = await dataResponse.json();
      const toolCall = dataResult.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        return new Response(
          JSON.stringify({ error: "No extraction returned" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = JSON.parse(toolCall.function.arguments);

      // Save extraction data
      const existingData =
        (paper.extraction_data as Record<string, string>) || {};
      const newData: Record<string, string> = { ...existingData };
      for (const ext of result.extractions) {
        newData[ext.column_name] = ext.value;
      }

      await supabase
        .from("uploaded_papers")
        .update({
          extraction_data: newData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paper_id);

      return new Response(JSON.stringify({ extractions: result.extractions, text_length: textContent.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        extracted_text: textContent.slice(0, 1000),
        text_length: textContent.length,
        status: "ready",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("extract-pdf error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
