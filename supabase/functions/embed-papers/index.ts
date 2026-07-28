import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth } from "../_shared/auth.ts";
import { callEmbeddings } from "../_shared/ai-caller.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

// Generate embedding via the user's configured API keys (Google, then OpenAI)
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await callEmbeddings(text);
    if (!response.ok) {
      const errText = await response.text();
      console.error('Embedding error:', response.status, errText);
      return null;
    }
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (err) {
    console.error('Embedding generation failed:', err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireAuth(req, corsHeaders);
  if ("error" in authResult) return authResult.error;

  try {
    const { papers } = await req.json();

    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return new Response(JSON.stringify({ error: 'papers array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let processedCount = 0;
    let skippedCount = 0;

    // Process papers in parallel (batches of 5)
    const batchSize = 5;
    for (let i = 0; i < papers.length; i += batchSize) {
      const batch = papers.slice(i, i + batchSize);

      await Promise.all(batch.map(async (paper: any) => {
        const paperId = paper.id;
        if (!paperId) return;

        // Check if chunks already exist for this paper
        const { data: existing } = await supabase
          .from('paper_chunks')
          .select('id')
          .eq('paper_id', paperId)
          .limit(1);

        if (existing && existing.length > 0) {
          skippedCount++;
          return;
        }

        // Get text to embed: prioritize full_text > extracted_text > abstract
        const text = paper.full_text || paper.extracted_text || paper.abstract || '';
        const textSource = paper.full_text ? 'full_text' : (paper.extracted_text ? 'full_text' : 'abstract');
        if (!text || text.length < 50) {
          skippedCount++;
          return;
        }

        // Chunk the text (larger chunks for full text)
        const chunkSize = textSource === 'full_text' ? 3000 : 2000;
        const chunks = chunkText(text, chunkSize);

        // Generate embeddings for each chunk
        for (let ci = 0; ci < chunks.length; ci++) {
          const embedding = await generateEmbedding(chunks[ci]);
          if (!embedding) continue;

          const { error: insertError } = await supabase
            .from('paper_chunks')
            .insert({
              paper_id: paperId,
              paper_title: paper.title || 'Untitled',
              chunk_index: ci,
              chunk_text: chunks[ci],
              embedding: embedding,
              source: textSource,
            });

          if (insertError) {
            console.error(`Insert error for paper ${paperId}, chunk ${ci}:`, insertError);
          }
        }
        processedCount++;
      }));
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      skipped: skippedCount,
      total: papers.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('embed-papers error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
