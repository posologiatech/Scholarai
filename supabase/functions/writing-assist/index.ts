import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  try {
    const { action, content, papers, section, citationStyle, datamindAnalyses, uploadedPDFs, language } = await req.json();
    const lang = language || "pt";

    const paperContext = (papers || []).map((p: any, i: number) => {
      const authors = Array.isArray(p.authors) ? p.authors.join(", ") : (p.authors || "Unknown");
      return `[${i + 1}] ${authors} (${p.year || "n.d."}). ${p.title}. ${p.journal || ""}. DOI: ${p.doi || "N/A"}`;
    }).join("\n");

    const datamindContext = (datamindAnalyses || []).length > 0
      ? `\n\n--- ANÁLISES DATAMIND DISPONÍVEIS ---\n${datamindAnalyses.map((a: any, i: number) => `Análise ${i + 1}: ${a.title || "Sem título"}\n${a.content}`).join("\n\n")}`
      : "";

    const uploadedPDFContext = (uploadedPDFs || []).length > 0
      ? `\n\n--- DOCUMENTOS PDF DO PESQUISADOR ---\n${uploadedPDFs.map((p: any, i: number) => `Documento ${i + 1}: ${p.title || "Sem título"}\n${(p.content || "").slice(0, 15000)}`).join("\n\n")}`
      : "";

    const citationFormats: Record<string, string> = {
      APA: "APA 7th: Author, A. A. (Year). Use (Author, Year) for inline citations.",
      Vancouver: "Vancouver: Number references in order of appearance. Use superscript or [1] for inline.",
      ABNT: "ABNT NBR 6023: SOBRENOME, Nome. Use (SOBRENOME, ano) for inline citations.",
    };
    const styleGuide = citationFormats[citationStyle || "APA"] || citationFormats.APA;

    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "draft_section": {
        systemPrompt = `You are an expert academic writing assistant specialized in scientific papers.
You write in ${lang === "pt" ? "Brazilian Portuguese" : "English"}.
Citation style: ${styleGuide}
You MUST cite the provided papers inline using the correct citation format.
When using DataMind analyses, integrate statistics naturally into the text.
When the researcher provides their own PDF documents, use the content as additional reference material and cite the findings appropriately.
Write in formal academic tone with clear, precise language.`;

        userPrompt = `Generate a draft for the "${section}" section of a scientific paper.

Available papers for citation:
${paperContext}
${datamindContext}
${uploadedPDFContext}

${content ? `Additional context/instructions from the author:\n${content}` : ""}

Write a complete, well-structured "${section}" section. Include inline citations from the provided papers. If DataMind analyses are available, incorporate relevant statistics and findings. If researcher PDF documents are provided, use their content as reference material.`;
        break;
      }

      case "insert_citation": {
        systemPrompt = `You are a citation formatting expert. Format citations precisely in ${citationStyle || "APA"} style.
${styleGuide}`;
        userPrompt = `Format the following paper as an inline citation and a reference list entry in ${citationStyle || "APA"} style:
${paperContext}

Also show how to cite it inline within a sentence.`;
        break;
      }

      case "rephrase": {
        systemPrompt = `You are an academic writing editor. Improve clarity, rigor, and flow of scientific text.
Write in ${lang === "pt" ? "Brazilian Portuguese" : "English"}.
Maintain the original meaning. Keep all citations intact.`;
        userPrompt = `Rephrase and improve the following text for academic clarity and rigor. Provide the improved version and briefly explain the changes:

"${content}"`;
        break;
      }

      case "check_consistency": {
        systemPrompt = `You are a scientific peer reviewer checking consistency between claims and evidence.
Write your analysis in ${lang === "pt" ? "Brazilian Portuguese" : "English"}.
Be thorough but constructive.`;
        userPrompt = `Check the consistency between claims and cited evidence in this text. Identify any:
1. Claims without supporting citations
2. Citations that don't support the claim they're attached to
3. Logical inconsistencies
4. Missing qualifiers or overgeneralizations

Text to review:
"${content}"

Available papers for verification:
${paperContext}
${datamindContext}
${uploadedPDFContext}`;
        break;
      }

      case "continue_writing": {
        systemPrompt = `You are an expert academic writing assistant. Continue writing from where the author left off.
Write in ${lang === "pt" ? "Brazilian Portuguese" : "English"}.
Citation style: ${styleGuide}
Maintain the same tone, style, and level of detail as the existing text.`;
        userPrompt = `Continue writing this scientific text seamlessly. Use the available papers for citations:

Current text:
"${content}"

Available papers:
${paperContext}
${datamindContext}
${uploadedPDFContext}`;
        break;
      }

      case "format_for_journal": {
        systemPrompt = `You are an expert academic formatting assistant.
You write in ${lang === "pt" ? "Brazilian Portuguese" : "English"}.
Citation style: ${styleGuide}
Given an article text and a target journal/publisher, reformat the article to match the journal's typical submission guidelines.
Include proper section structure, citation formatting, and any standard elements required.
Maintain all original content and citations.`;

        userPrompt = `Reformat the following article according to the submission guidelines of the specified publisher/journal.

${content}

Available papers for citation:
${paperContext}
${datamindContext}
${uploadedPDFContext}

Reformat the article maintaining all content but adjusting structure, formatting, and citations to match the target journal's requirements.`;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const aiResponse = await callAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("writing-assist error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
