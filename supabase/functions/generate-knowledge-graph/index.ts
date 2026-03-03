import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";

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

  try {
    const { papers, query, locale = "en" } = await req.json();

    if (!papers?.length) {
      return new Response(JSON.stringify({ error: "No papers provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a summary of papers for the AI
    const papersSummary = papers.slice(0, 30).map((p: Paper, i: number) => 
      `[${i}] "${p.title}" by ${(p.authors || []).slice(0, 3).join(", ")}${(p.authors || []).length > 3 ? " et al." : ""} (${p.year || "n.d."})${p.journal ? ` — ${p.journal}` : ""}${p.citationCount ? ` [${p.citationCount} citations]` : ""}\nAbstract: ${(p.abstract || "").slice(0, 300)}...`
    ).join("\n\n");

    const systemPrompt = `You are a knowledge graph generator for academic research. Analyze the given papers and extract a structured knowledge graph with nodes and edges.

Node types:
- "paper": A research paper (use paper index as id prefix: "p0", "p1", etc.)
- "author": A key author (use "a_" + normalized name: "a_john_smith")
- "concept": A key concept/topic extracted from the papers (use "c_" + slug: "c_machine_learning")
- "method": A methodology used (use "m_" + slug: "m_meta_analysis")

Edge types:
- "cites": paper -> paper (when one paper likely references another based on topic overlap)
- "authored": author -> paper
- "discusses": paper -> concept
- "uses_method": paper -> method
- "related": concept -> concept (when concepts are related)

Rules:
- Extract 5-10 key concepts from the corpus
- Extract 3-6 key methods/methodologies
- Identify the top 5-8 most prominent authors
- Create edges showing relationships
- For each concept node, add a "cluster" field grouping related concepts (use a color name: "blue", "green", "purple", "orange", "red", "cyan")
- For paper nodes, assign them to the cluster of their primary concept
- Each node needs: id, type, label, and optional metadata (year, citationCount, cluster)
- Keep it focused and meaningful — quality over quantity`;

    const userPrompt = `Research query: "${query}"

Papers:
${papersSummary}

Generate the knowledge graph. Return ONLY valid JSON with this structure:
{
  "nodes": [
    { "id": "p0", "type": "paper", "label": "Short title", "year": 2023, "citationCount": 45, "cluster": "blue", "paperIndex": 0 },
    { "id": "a_john_smith", "type": "author", "label": "John Smith", "paperCount": 3 },
    { "id": "c_machine_learning", "type": "concept", "label": "Machine Learning", "cluster": "blue" },
    { "id": "m_rct", "type": "method", "label": "Randomized Controlled Trial", "cluster": "green" }
  ],
  "edges": [
    { "source": "p0", "target": "c_machine_learning", "type": "discusses" },
    { "source": "a_john_smith", "target": "p0", "type": "authored" },
    { "source": "p0", "target": "m_rct", "type": "uses_method" }
  ],
  "clusters": [
    { "id": "blue", "label": "Cluster Theme Name", "conceptCount": 3 }
  ]
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
            name: "build_knowledge_graph",
            description: "Build a knowledge graph from academic papers",
            parameters: {
              type: "object",
              properties: {
                nodes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      type: { type: "string", enum: ["paper", "author", "concept", "method"] },
                      label: { type: "string" },
                      year: { type: "number" },
                      citationCount: { type: "number" },
                      cluster: { type: "string" },
                      paperIndex: { type: "number" },
                      paperCount: { type: "number" },
                    },
                    required: ["id", "type", "label"],
                  },
                },
                edges: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      source: { type: "string" },
                      target: { type: "string" },
                      type: { type: "string", enum: ["cites", "authored", "discusses", "uses_method", "related"] },
                    },
                    required: ["source", "target", "type"],
                  },
                },
                clusters: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      label: { type: "string" },
                      conceptCount: { type: "number" },
                    },
                    required: ["id", "label"],
                  },
                },
              },
              required: ["nodes", "edges", "clusters"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "build_knowledge_graph" } },
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
      // Fallback: try to extract JSON from content
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
