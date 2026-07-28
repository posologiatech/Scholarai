import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { requireAuth } from "../_shared/auth.ts";
import { callAI, callEmbeddings } from "../_shared/ai-caller.ts";

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
  supabase: any
) {
  const chunks = chunkText(text);

  for (let i = 0; i < chunks.length; i++) {
    try {
      const embResponse = await callEmbeddings(chunks[i].slice(0, 2048));

      if (!embResponse.ok) {
        const errBody = await embResponse.text().catch(() => '');
        console.error(`Embedding error for chunk ${i}: ${embResponse.status} - ${errBody.slice(0, 200)}`);
        // If model not supported, stop trying all chunks
        if (embResponse.status === 400 || embResponse.status === 404) {
          console.error('Embedding model may not be supported, skipping remaining chunks');
          break;
        }
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
    } catch (chunkErr) {
      console.error(`Embedding chunk ${i} exception:`, chunkErr);
      continue;
    }
  }
}

// Encode ArrayBuffer to base64 without btoa (handles large files)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 32768;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      await supabase
        .from("uploaded_papers")
        .update({ status: "processing" })
        .eq("id", paper_id);

      // Download PDF from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("papers")
        .download(paper.file_path);

      if (downloadError || !fileData) {
        console.error("Download error:", downloadError);
        await supabase
          .from("uploaded_papers")
          .update({ status: "error" })
          .eq("id", paper_id);
        return new Response(
          JSON.stringify({ error: "Failed to download PDF from storage" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check file size - limit to 10MB for base64 encoding
      const arrayBuffer = await fileData.arrayBuffer();
      const fileSizeMB = arrayBuffer.byteLength / (1024 * 1024);
      console.log(`PDF size: ${fileSizeMB.toFixed(2)} MB`);

      if (fileSizeMB > 15) {
        await supabase
          .from("uploaded_papers")
          .update({ status: "error" })
          .eq("id", paper_id);
        return new Response(
          JSON.stringify({ error: "PDF too large. Maximum 15MB supported." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Convert PDF to base64
      let base64: string;
      try {
        base64 = arrayBufferToBase64(arrayBuffer);
      } catch (encodeErr) {
        console.error("Base64 encoding error:", encodeErr);
        await supabase
          .from("uploaded_papers")
          .update({ status: "error" })
          .eq("id", paper_id);
        return new Response(
          JSON.stringify({ error: "Failed to encode PDF" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use Gemini to extract text from PDF via callAI
      // Skip non-multimodal providers (groq, openai text models can't handle PDF base64)
      console.log("Starting text extraction via AI...");
      const extractResponse = await callAI({
        model: "google/gemini-2.5-flash",
        _skipProviders: ["groq", "openai"],
        messages: [
          {
            role: "system",
            content:
              "You are a document text extraction assistant. Extract ALL text content from the provided PDF document. Preserve the structure including title, authors, abstract, sections, references. Output the full text faithfully. Do NOT add any commentary or headers like '==Start of text extraction=='.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all the text from this PDF document. Preserve structure and formatting. Output ONLY the extracted text, no wrapper markers.",
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
      } as any);

      if (!extractResponse.ok) {
        const errText = await extractResponse.text();
        console.error("Text extraction error:", extractResponse.status, errText);
        
        // Try fallback: simpler prompt without multimodal
        console.log("Trying text-only fallback extraction...");
        
        // For the fallback, we'll try to get a signed URL and use fetch to get text
        const { data: signedUrl } = await supabase.storage
          .from("papers")
          .createSignedUrl(paper.file_path, 300);
        
        let fallbackText = '';
        if (signedUrl?.signedUrl) {
          // Try pdf.js-like extraction won't work in edge, so just report the error clearly
          console.error("PDF extraction failed - AI could not process the file");
        }
        
        if (!fallbackText) {
          await supabase
            .from("uploaded_papers")
            .update({ status: "error" })
            .eq("id", paper_id);
          return new Response(
            JSON.stringify({ error: "Failed to extract text from PDF. The AI service could not process this file. Try a smaller or text-based PDF." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const extractData = await extractResponse.json();
      textContent = extractData.choices?.[0]?.message?.content || "";
      
      // Clean up extraction artifacts
      textContent = textContent
        .replace(/^==\s*Start of text extraction\s*==\s*/i, '')
        .replace(/==\s*End of text extraction\s*==\s*$/i, '')
        .replace(/^```[\s\S]*?\n/, '')
        .replace(/\n```\s*$/, '')
        .trim();

      if (!textContent || textContent.length < 50) {
        await supabase
          .from("uploaded_papers")
          .update({ status: "error" })
          .eq("id", paper_id);
        return new Response(
          JSON.stringify({ error: "Could not extract meaningful text from the PDF" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try to extract title from the text
      const titleMatch = textContent.match(/^#?\s*(.+?)[\n\r]/);
      const extractedTitle = titleMatch ? titleMatch[1].trim().slice(0, 200) : paper.file_name.replace(/\.pdf$/i, "");

      // Save extracted text
      await supabase
        .from("uploaded_papers")
        .update({
          extracted_text: textContent.slice(0, 100000),
          title: extractedTitle,
          status: "processed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paper_id);

      console.log(`Text extracted successfully: ${textContent.length} chars`);

      // Generate embeddings in background
      try {
        await generateAndSaveEmbeddings(paper_id, extractedTitle, textContent, supabase);
        console.log(`Embeddings generated for paper ${paper_id}`);
      } catch (embErr) {
        console.error(`Embedding generation failed for paper ${paper_id}:`, embErr);
      }
    } else {
      // Text already exists — check if embeddings exist
      const { data: existingChunks } = await supabase
        .from('paper_chunks')
        .select('id')
        .eq('paper_id', paper_id)
        .limit(1);

      if (!existingChunks || existingChunks.length === 0) {
        try {
          const title = paper.title || paper.file_name.replace(/\.pdf$/i, "");
          await generateAndSaveEmbeddings(paper_id, title, textContent, supabase);
        } catch (embErr) {
          console.error(`Embedding generation failed for paper ${paper_id}:`, embErr);
        }
      }
    }

    // If columns are provided, extract structured data
    if (columns && Array.isArray(columns) && columns.length > 0 && query) {
      const columnDetails = columns
        .map((c: any) => `- "${c.name}": ${c.prompt || c.description || c.name}`)
        .join("\n");

      const systemPrompt =
        locale === "pt"
          ? `Você é um pesquisador científico sênior especializado em extração de dados de artigos acadêmicos com RIGOR METODOLÓGICO.

[REGRAS OBRIGATÓRIAS]
1. Use SOMENTE informações presentes no texto fornecido. ZERO FABRICAÇÃO.
2. Para cada coluna solicitada, forneça uma resposta COMPLETA, DETALHADA e ESPECÍFICA — não responda em uma frase genérica.
3. Estruture as respostas com profundidade adequada:
   - Para "desenho de estudo" / "metodologia": especifique tipo (ECR, coorte, transversal, revisão sistemática, etc.), população/amostra (N, características), intervenção/exposição, comparador, desfechos primários e secundários, análise estatística usada.
   - Para "resultados": inclua dados quantitativos quando disponíveis (p-valor, IC95%, OR, RR, tamanho de efeito), com a magnitude do achado.
   - Para "conclusões": principais achados E limitações reconhecidas.
   - Para "população": tamanho amostral, critérios de inclusão/exclusão, contexto.
4. Cite TRECHOS LITERAIS do texto entre aspas quando relevante para sustentar a extração.
5. Se a informação NÃO estiver no texto, escreva exatamente "Não mencionado no texto" — NUNCA invente.
6. Cada resposta deve ter no MÍNIMO 3-5 frases substantivas quando a informação estiver disponível.
7. Responda APENAS usando a função fornecida.`
          : `You are a senior scientific researcher specialized in extracting data from academic papers with METHODOLOGICAL RIGOR.

[MANDATORY RULES]
1. Use ONLY information present in the provided text. ZERO FABRICATION.
2. For each requested column, provide a COMPLETE, DETAILED and SPECIFIC answer — never reply with a generic single sentence.
3. Structure responses with appropriate depth:
   - For "study design" / "methodology": specify type (RCT, cohort, cross-sectional, systematic review, etc.), population/sample (N, characteristics), intervention/exposure, comparator, primary and secondary outcomes, statistical analysis used.
   - For "results": include quantitative data when available (p-value, 95%CI, OR, RR, effect size), with magnitude of findings.
   - For "conclusions": main findings AND acknowledged limitations.
   - For "population": sample size, inclusion/exclusion criteria, setting.
4. Quote LITERAL excerpts from the text when relevant to support extraction.
5. If information is NOT in the text, write exactly "Not mentioned in text" — NEVER invent.
6. Each answer must contain at LEAST 3-5 substantive sentences when information is available.
7. Respond ONLY using the provided function.`;

      // Use a larger window of the paper to avoid losing methods/results sections
      const paperWindow = textContent.slice(0, 80000);

      const dataResponse = await callAI({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Research question: "${query}"\n\nColumns to extract (each must be answered in depth, with at least 3-5 sentences when info is available):\n${columnDetails}\n\nFull paper text:\n${paperWindow}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_paper_data",
              description: "Return extracted data for each column from the paper",
              parameters: {
                type: "object",
                properties: {
                  extractions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        column_name: { type: "string" },
                        value: { type: "string", description: "Detailed extraction (3-5+ sentences) or 'Não mencionado no texto'" },
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
      });

      if (!dataResponse.ok) {
        // Always release "processing" lock on failure to avoid stuck UI
        await supabase
          .from("uploaded_papers")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("id", paper_id);

        if (dataResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        await supabase
          .from("uploaded_papers")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("id", paper_id);
        return new Response(
          JSON.stringify({ error: "No extraction returned" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = JSON.parse(toolCall.function.arguments);

      const existingData = (paper.extraction_data as Record<string, string>) || {};
      const newData: Record<string, string> = { ...existingData };
      for (const ext of result.extractions) {
        newData[ext.column_name] = ext.value;
      }

      await supabase
        .from("uploaded_papers")
        .update({
          extraction_data: newData,
          status: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paper_id);

      return new Response(JSON.stringify({ extractions: result.extractions, text_length: textContent.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No columns: just text extraction; mark as ready
    await supabase
      .from("uploaded_papers")
      .update({ status: "ready", updated_at: new Date().toISOString() })
      .eq("id", paper_id);

    return new Response(
      JSON.stringify({
        extracted_text: textContent.slice(0, 1000),
        text_length: textContent.length,
        status: "processed",
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
