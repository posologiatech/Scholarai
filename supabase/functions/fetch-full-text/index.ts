const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Strip XML/HTML tags and clean whitespace
function stripTags(xml: string): string {
  // Remove reference lists (they're noise for extraction)
  let text = xml.replace(/<ref-list[\s\S]*?<\/ref-list>/gi, '');
  // Remove all tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

// Fetch full text from Europe PMC
async function fetchFromEuropePMC(source: string, externalId: string): Promise<string | null> {
  try {
    // Europe PMC uses source/id format, e.g. MED/12345678
    const pmcSource = source === 'pubmed' ? 'MED' : source?.toUpperCase() || 'MED';
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/${pmcSource}/${externalId}/fullTextXML`;
    
    const response = await fetch(url, { 
      headers: { 'Accept': 'application/xml' },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) {
      console.log(`Europe PMC: ${response.status} for ${pmcSource}/${externalId}`);
      return null;
    }
    
    const xml = await response.text();
    if (!xml || xml.length < 500) return null;
    
    const cleanText = stripTags(xml);
    // Only return if we got substantial text (more than just metadata)
    if (cleanText.length < 1000) return null;
    
    console.log(`Europe PMC: got ${cleanText.length} chars for ${externalId}`);
    return cleanText;
  } catch (err) {
    console.error(`Europe PMC error for ${externalId}:`, err);
    return null;
  }
}

// Search Europe PMC by DOI to get PMCID, then fetch full text
async function fetchFromEuropePMCByDOI(doi: string): Promise<string | null> {
  try {
    const searchUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:"${encodeURIComponent(doi)}"&format=json&resultType=core`;
    const searchResp = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
    if (!searchResp.ok) return null;
    
    const searchData = await searchResp.json();
    const result = searchData?.resultList?.result?.[0];
    if (!result) return null;
    
    // Try with PMCID first (most likely to have full text)
    if (result.pmcid) {
      const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC/${result.pmcid}/fullTextXML`;
      const resp = await fetch(url, { 
        headers: { 'Accept': 'application/xml' },
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const xml = await resp.text();
        const cleanText = stripTags(xml);
        if (cleanText.length > 1000) {
          console.log(`Europe PMC (DOI->PMC): got ${cleanText.length} chars for ${doi}`);
          return cleanText;
        }
      }
    }
    
    // Try with PMID
    if (result.pmid) {
      return fetchFromEuropePMC('MED', result.pmid);
    }
    
    return null;
  } catch (err) {
    console.error(`Europe PMC DOI search error for ${doi}:`, err);
    return null;
  }
}

// Fetch OA PDF/HTML URL from Unpaywall
async function fetchFromUnpaywall(doi: string): Promise<string | null> {
  try {
    const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=team@arca.research`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    // Find best OA location with HTML or text content
    const locations = data.oa_locations || [];
    
    // Prefer HTML pages over PDFs (easier to extract text)
    for (const loc of locations) {
      if (loc.url_for_landing_page && !loc.url_for_landing_page.endsWith('.pdf')) {
        try {
          const pageResp = await fetch(loc.url_for_landing_page, { 
            signal: AbortSignal.timeout(15000),
            headers: { 'Accept': 'text/html' },
          });
          if (pageResp.ok) {
            const html = await pageResp.text();
            // Extract main article content
            const bodyMatch = html.match(/<article[\s\S]*?<\/article>/i) || 
                              html.match(/<main[\s\S]*?<\/main>/i) ||
                              html.match(/<body[\s\S]*?<\/body>/i);
            if (bodyMatch) {
              const cleanText = stripTags(bodyMatch[0]);
              if (cleanText.length > 2000) {
                console.log(`Unpaywall HTML: got ${cleanText.length} chars for ${doi}`);
                return cleanText;
              }
            }
          }
        } catch {
          // Continue to next location
        }
      }
    }
    
    return null;
  } catch (err) {
    console.error(`Unpaywall error for ${doi}:`, err);
    return null;
  }
}

interface PaperInput {
  id: string;
  doi?: string;
  source?: string;
  external_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { papers } = await req.json() as { papers: PaperInput[] };

    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return new Response(JSON.stringify({ error: 'papers array is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Record<string, string> = {};
    let foundCount = 0;

    // Process in batches of 3 to avoid overwhelming APIs
    const batchSize = 3;
    for (let i = 0; i < papers.length; i += batchSize) {
      const batch = papers.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (paper) => {
        let fullText: string | null = null;

        // Strategy 1: Try Europe PMC with external_id (fastest for PubMed papers)
        if (!fullText && paper.external_id && paper.source) {
          fullText = await fetchFromEuropePMC(paper.source, paper.external_id);
        }

        // Strategy 2: Try Europe PMC search by DOI
        if (!fullText && paper.doi) {
          fullText = await fetchFromEuropePMCByDOI(paper.doi);
        }

        // Strategy 3: Try Unpaywall for OA HTML content
        if (!fullText && paper.doi) {
          fullText = await fetchFromUnpaywall(paper.doi);
        }

        if (fullText) {
          // Truncate to ~50k chars to keep things manageable
          results[paper.id] = fullText.slice(0, 50000);
          foundCount++;
        }
      }));
    }

    console.log(`fetch-full-text: found ${foundCount}/${papers.length} full texts`);

    return new Response(JSON.stringify({ 
      results, 
      found: foundCount, 
      total: papers.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('fetch-full-text error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
