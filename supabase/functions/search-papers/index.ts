const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  source: 'semantic_scholar' | 'pubmed';
  citationCount?: number;
  doi?: string;
  url?: string;
}

async function searchSemanticScholar(query: string, limit = 10): Promise<Paper[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,authors,year,abstract,citationCount,externalIds,url`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((p: any) => ({
      id: `ss_${p.paperId}`,
      title: p.title || '',
      authors: (p.authors || []).map((a: any) => a.name),
      year: p.year,
      abstract: p.abstract || '',
      source: 'semantic_scholar' as const,
      citationCount: p.citationCount,
      doi: p.externalIds?.DOI,
      url: p.url,
    }));
  } catch {
    return [];
  }
}

async function searchPubMed(query: string, limit = 10): Promise<Paper[]> {
  try {
    // Step 1: search for IDs
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const ids: string[] = searchData.esearchresult?.idlist || [];
    if (ids.length === 0) return [];

    // Step 2: fetch details
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
    const fetchRes = await fetch(fetchUrl);
    if (!fetchRes.ok) return [];
    const fetchData = await fetchRes.json();

    // Step 3: fetch abstracts
    const abstractUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&rettype=abstract&retmode=xml`;
    const abstractRes = await fetch(abstractUrl);
    const abstractXml = abstractRes.ok ? await abstractRes.text() : '';

    // Simple XML abstract extraction
    const abstracts: Record<string, string> = {};
    const articleRegex = /<PubmedArticle>[\s\S]*?<PMID[^>]*>(\d+)<\/PMID>[\s\S]*?(?:<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>|<\/PubmedArticle>)/g;
    let match;
    while ((match = articleRegex.exec(abstractXml)) !== null) {
      if (match[2]) {
        abstracts[match[1]] = match[2].replace(/<[^>]+>/g, '').trim();
      }
    }

    return ids.map((id) => {
      const item = fetchData.result?.[id];
      if (!item) return null;
      const authors = (item.authors || []).map((a: any) => a.name);
      const pubYear = item.pubdate ? parseInt(item.pubdate.substring(0, 4)) : null;
      const doi = (item.elocationid || '').replace('doi: ', '');
      return {
        id: `pm_${id}`,
        title: item.title || '',
        authors,
        year: isNaN(pubYear!) ? null : pubYear,
        abstract: abstracts[id] || '',
        source: 'pubmed' as const,
        citationCount: undefined,
        doi: doi || undefined,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      };
    }).filter(Boolean) as Paper[];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, sources = ['semantic_scholar', 'pubmed'], limit = 10 } = await req.json();

    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const promises: Promise<Paper[]>[] = [];
    if (sources.includes('semantic_scholar')) promises.push(searchSemanticScholar(query, limit));
    if (sources.includes('pubmed')) promises.push(searchPubMed(query, limit));

    const results = await Promise.all(promises);
    const papers = results.flat();

    // Deduplicate by DOI
    const seen = new Set<string>();
    const unique: Paper[] = [];
    for (const p of papers) {
      const key = p.doi || p.id;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(p);
      }
    }

    return new Response(JSON.stringify({ papers: unique, total: unique.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
