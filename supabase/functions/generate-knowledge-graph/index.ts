import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";
import { checkPlanLimit, planLimitExceededResponse } from "../_shared/plan-limits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  doi?: string;
  journal?: string;
  citationCount?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if ("error" in auth) return auth.error;

  if (!(await checkPlanLimit(auth.supabase, auth.userId, "knowledge_graph"))) {
    return planLimitExceededResponse(corsHeaders, "knowledge_graph");
  }

  try {
    const { papers, query, locale = "en" } = await req.json();

    if (!papers?.length) {
      return new Response(JSON.stringify({ error: "No papers provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const papersSummary = papers.slice(0, 30).map((p: Paper, i: number) =>
      `[${i}] "${p.title}" by ${(p.authors || []).slice(0, 3).join(", ")}${(p.authors || []).length > 3 ? " et al." : ""} (${p.year || "n.d."})${p.journal ? ` — ${p.journal}` : ""}${p.citationCount ? ` [${p.citationCount} citations]` : ""}\nAbstract: ${(p.abstract || "").slice(0, 300)}...`
    ).join("\n\n");

    const systemPrompt = `You are a Connected Papers-style graph generator. Given a set of academic papers from a search query, you must:

1. Treat paper [0] as the ORIGIN paper (seed paper).
2. Generate ONLY paper nodes — no authors, concepts, or methods as separate nodes.
3. For each paper node, assign a similarity score (0-100) relative to the origin paper based on:
   - Topic overlap from abstracts
   - Likely co-citation patterns  
   - Bibliographic coupling (shared references)
4. Generate edges between papers that are similar (similarity > 30). Edge weight = similarity score.
5. Identify "Prior Works" — older foundational papers that the corpus builds upon.
6. Identify "Derivative Works" — newer papers that extend or survey the corpus.

Rules:
- All nodes are papers. Use "p0", "p1", etc. as IDs matching paper indices.
- Each node must have: id, label (short title ≤60 chars), year, citationCount, paperIndex, similarity (to origin).
- Each edge must have: source, target, weight (similarity 0-100).
- Origin paper (p0) has similarity: 100.
- Prior works: papers published BEFORE the origin that are highly cited/foundational. List their paperIndex values.
- Derivative works: papers published AFTER the origin that cite or build upon the corpus. List their paperIndex values.
- Generate a TL;DR summary (1-2 sentences) for each paper based on its abstract.`;

    const userPrompt = `Research query: "${query}"

Papers:
${papersSummary}

Generate the Connected Papers-style graph. Return ONLY valid JSON:
{
  "nodes": [
    { "id": "p0", "label": "Short Title", "year": 2023, "citationCount": 45, "paperIndex": 0, "similarity": 100, "tldr": "One sentence summary." }
  ],
  "edges": [
    { "source": "p0", "target": "p1", "weight": 75 }
  ],
  "priorWorks": [1, 5, 8],
  "derivativeWorks": [3, 7, 12]
}`;

    const aiResponse = await callAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "google/gemini-3-flash-preview",
      tools: [
        {
          type: "function",
          function: {
            name: "build_connected_graph",
            description: "Build a Connected Papers-style similarity graph from academic papers",
            parameters: {
              type: "object",
              properties: {
                nodes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      label: { type: "string" },
                      year: { type: "number" },
                      citationCount: { type: "number" },
                      paperIndex: { type: "number" },
                      similarity: { type: "number" },
                      tldr: { type: "string" },
                    },
                    required: ["id", "label", "paperIndex", "similarity"],
                  },
                },
                edges: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      source: { type: "string" },
                      target: { type: "string" },
                      weight: { type: "number" },
                    },
                    required: ["source", "target", "weight"],
                  },
                },
                priorWorks: {
                  type: "array",
                  items: { type: "number" },
                },
                derivativeWorks: {
                  type: "array",
                  items: { type: "number" },
                },
              },
              required: ["nodes", "edges", "priorWorks", "derivativeWorks"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "build_connected_graph" } },
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI response error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();

    let graphData;
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      graphData = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        graphData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse graph data from AI response");
      }
    }

    return new Response(JSON.stringify(graphData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-knowledge-graph error:", err);
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
