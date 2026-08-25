import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callAI } from '../_shared/ai-caller.ts';
import { getGoogleApiKey, generateGoogleImage } from '../_shared/google-image.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VENUES: Array<{ query: string; label: string }> = [
  { query: 'N Engl J Med', label: 'NEJM' },
  { query: 'Nature', label: 'Nature' },
  { query: 'JAMA', label: 'JAMA' },
  { query: 'Lancet', label: 'The Lancet' },
  { query: 'BMJ', label: 'BMJ' },
  { query: 'Cell', label: 'Cell' },
  { query: 'Nat Med', label: 'Nature Medicine' },
  { query: 'Science', label: 'Science' },
];
const CAP = 8;
const MAX_KEPT = 120;
const MAX_AGE_DAYS = 45;

interface Candidate {
  doi: string;
  title: string;
  abstract: string;
  journal: string;
  sourceLabel: string;
  paperUrl: string;
  publishedAt: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchVenueCandidates(venue: { query: string; label: string }, year: number): Promise<Candidate[]> {
  try {
    const query = `JOURNAL:"${venue.query}" AND PUB_YEAR:${year} AND HAS_ABSTRACT:y`;
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&resultType=core&pageSize=5&sort=P_PDATE_D%20desc&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.error(`[refresh-discover-feed] EuropePMC status ${res.status} for venue ${venue.label}`);
      return [];
    }
    const data = await res.json();
    return (data.resultList?.result || [])
      .filter((r: any) => r.doi && r.abstractText && r.title)
      .map((r: any) => ({
        doi: r.doi,
        title: r.title,
        abstract: r.abstractText,
        journal: r.journalTitle || venue.label,
        sourceLabel: venue.label,
        paperUrl: `https://doi.org/${r.doi}`,
        publishedAt: r.firstPublicationDate || `${year}-01-01`,
      }));
  } catch (e) {
    console.error(`[refresh-discover-feed] EuropePMC error for venue ${venue.label}:`, e);
    return [];
  }
}

async function generateSummary(c: Candidate): Promise<string> {
  const resp = await callAI({
    messages: [
      {
        role: 'system',
        content: 'You are a science news editor. Write a 2-3 sentence summary of the study below for a general scientific audience. Use only the information given in the title and abstract — do not invent findings, numbers, or claims not present in the source text. Be factual and neutral.',
      },
      {
        role: 'user',
        content: `Title: ${c.title}\nJournal: ${c.journal}\nAbstract: ${c.abstract.slice(0, 3000)}`,
      },
    ],
    model: 'google/gemini-3-flash-preview',
    _promptType: 'discover_summary',
  });
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No summary returned');
  return text.trim();
}

async function generateCoverImage(c: Candidate, apiKey: string): Promise<string> {
  const base64Url = await generateGoogleImage({
    apiKey,
    model: 'gemini-3-pro-image-preview',
    systemText: 'You are an editorial illustrator for a science news magazine, in the style of The Economist or Nature News covers — abstract, conceptual, painterly or flat-vector, evocative of the topic. NOT a data diagram, NOT a graphical abstract, no text or labels in the image.',
    textPrompt: `Editorial illustration representing: ${c.title}. Topic derived from: ${c.abstract.slice(0, 300)}`,
  });
  return base64Url;
}

async function uploadCover(serviceClient: ReturnType<typeof createClient>, base64Url: string): Promise<string> {
  const base64Data = base64Url.replace(/^data:image\/\w+;base64,/, '');
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

  const fileName = `${crypto.randomUUID()}.png`;
  const { error: uploadError } = await serviceClient.storage
    .from('discover-covers')
    .upload(fileName, bytes, { contentType: 'image/png', upsert: false });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data } = serviceClient.storage.from('discover-covers').getPublicUrl(fileName);
  return data.publicUrl;
}

// Rotated-out items are archived (archived_at set), not deleted, so they remain
// visible in the /discover/history timeline. Only currently non-archived rows
// count toward the "current" feed and its MAX_KEPT cap.
async function archiveOldRows(serviceClient: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  await serviceClient
    .from('discover_items')
    .update({ archived_at: now })
    .is('archived_at', null)
    .lt('published_at', cutoff);

  const { data: keep } = await serviceClient
    .from('discover_items')
    .select('id')
    .is('archived_at', null)
    .order('published_at', { ascending: false })
    .limit(MAX_KEPT);
  const keepIds = (keep || []).map((r: any) => r.id);
  if (keepIds.length > 0) {
    await serviceClient
      .from('discover_items')
      .update({ archived_at: now })
      .is('archived_at', null)
      .not('id', 'in', `(${keepIds.join(',')})`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    await archiveOldRows(serviceClient);

    const { data: existing } = await serviceClient.from('discover_items').select('doi');
    const existingDois = new Set((existing || []).map((r: any) => r.doi));

    const year = new Date().getFullYear();
    const candidates: Candidate[] = [];
    for (const venue of VENUES) {
      const results = await fetchVenueCandidates(venue, year);
      const fresh = results.filter((c) => !existingDois.has(c.doi));
      candidates.push(...fresh.slice(0, 3));
      await sleep(500);
    }

    const seen = new Set<string>();
    const deduped = candidates.filter((c) => (seen.has(c.doi) ? false : (seen.add(c.doi), true)));
    const toProcess = deduped.slice(0, CAP);

    const googleApiKey = await getGoogleApiKey(serviceClient);
    if (!googleApiKey) {
      console.error('[refresh-discover-feed] No Google API key configured, skipping image generation');
    }

    let created = 0;
    const batchSize = 3;
    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize);
      await Promise.all(batch.map(async (c) => {
        try {
          if (!googleApiKey) return;
          const [summary, base64Image] = await Promise.all([
            generateSummary(c),
            generateCoverImage(c, googleApiKey),
          ]);
          const imageUrl = await uploadCover(serviceClient, base64Image);

          const { error } = await serviceClient.from('discover_items').upsert({
            doi: c.doi,
            title: c.title,
            source_label: c.sourceLabel,
            summary,
            image_url: imageUrl,
            paper_url: c.paperUrl,
            published_at: c.publishedAt,
          }, { onConflict: 'doi', ignoreDuplicates: true });

          if (error) {
            console.error(`[refresh-discover-feed] Insert failed for ${c.doi}:`, error.message);
          } else {
            created++;
          }
        } catch (e) {
          console.error(`[refresh-discover-feed] Failed to process "${c.title}":`, e);
        }
      }));
    }

    console.log(`[refresh-discover-feed] candidates=${deduped.length} processed=${toProcess.length} created=${created}`);

    return new Response(JSON.stringify({ candidates_found: deduped.length, new_items_created: created }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[refresh-discover-feed] error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
