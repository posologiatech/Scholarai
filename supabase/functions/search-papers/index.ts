const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type SourceType = 'semantic_scholar' | 'pubmed' | 'openalex' | 'clinical_trials' | 'europe_pmc';

interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  source: SourceType;
  citationCount?: number;
  doi?: string;
  url?: string;
  journal?: string;
  openAccess?: boolean;
}

// ─── Semantic Scholar ───────────────────────────────────────────────
async function searchSemanticScholar(query: string, limit = 10): Promise<Paper[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,authors,year,abstract,citationCount,externalIds,url,journal,isOpenAccess`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error('[SemanticScholar] Status:', res.status);
      return [];
    }
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
      journal: p.journal?.name,
      openAccess: p.isOpenAccess,
    }));
  } catch (e) {
    console.error('[SemanticScholar] Error:', e);
    return [];
  }
}

// ─── PubMed ─────────────────────────────────────────────────────────
async function searchPubMed(query: string, limit = 10): Promise<Paper[]> {
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const ids: string[] = searchData.esearchresult?.idlist || [];
    if (ids.length === 0) return [];

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
    const fetchRes = await fetch(fetchUrl);
    if (!fetchRes.ok) return [];
    const fetchData = await fetchRes.json();

    const abstractUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&rettype=abstract&retmode=xml`;
    const abstractRes = await fetch(abstractUrl);
    const abstractXml = abstractRes.ok ? await abstractRes.text() : '';

    // Extract abstracts – handle multiple <AbstractText> tags per article
    const abstracts: Record<string, string> = {};
    const articleBlocks = abstractXml.split('<PubmedArticle>');
    for (const block of articleBlocks) {
      const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
      if (!pmidMatch) continue;
      const pmid = pmidMatch[1];
      const textParts: string[] = [];
      const abstractTextRegex = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g;
      let m;
      while ((m = abstractTextRegex.exec(block)) !== null) {
        textParts.push(m[1].replace(/<[^>]+>/g, '').trim());
      }
      if (textParts.length > 0) {
        abstracts[pmid] = textParts.join(' ');
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
        journal: item.fulljournalname || item.source,
      };
    }).filter(Boolean) as Paper[];
  } catch (e) {
    console.error('[PubMed] Error:', e);
    return [];
  }
}

// ─── OpenAlex ───────────────────────────────────────────────────────
async function searchOpenAlex(query: string, limit = 10): Promise<Paper[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${limit}&select=id,title,authorships,publication_year,abstract_inverted_index,cited_by_count,doi,primary_location,open_access&mailto=scholarai@research.app`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error('[OpenAlex] Status:', res.status);
      return [];
    }
    const data = await res.json();
    return (data.results || []).map((w: any) => {
      // Reconstruct abstract from inverted index
      let abstract = '';
      if (w.abstract_inverted_index) {
        const words: [string, number][] = [];
        for (const [word, positions] of Object.entries(w.abstract_inverted_index)) {
          for (const pos of positions as number[]) {
            words.push([word, pos]);
          }
        }
        words.sort((a, b) => a[1] - b[1]);
        abstract = words.map(([w]) => w).join(' ');
      }

      const doi = w.doi ? w.doi.replace('https://doi.org/', '') : undefined;
      const oaId = w.id?.replace('https://openalex.org/', '') || '';

      return {
        id: `oa_${oaId}`,
        title: w.title || '',
        authors: (w.authorships || []).slice(0, 10).map((a: any) => a.author?.display_name || ''),
        year: w.publication_year,
        abstract,
        source: 'openalex' as const,
        citationCount: w.cited_by_count,
        doi,
        url: w.primary_location?.landing_page_url || w.doi || `https://openalex.org/${oaId}`,
        journal: w.primary_location?.source?.display_name,
        openAccess: w.open_access?.is_oa,
      };
    });
  } catch (e) {
    console.error('[OpenAlex] Error:', e);
    return [];
  }
}

// ─── ClinicalTrials.gov ─────────────────────────────────────────────
async function searchClinicalTrials(query: string, limit = 10): Promise<Paper[]> {
  try {
    const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(query)}&pageSize=${limit}&fields=NCTId,BriefTitle,OverallStatus,Condition,InterventionName,StartDate,BriefSummary,LeadSponsorName,StudyType&format=json`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error('[ClinicalTrials] Status:', res.status);
      return [];
    }
    const data = await res.json();
    return (data.studies || []).map((s: any) => {
      const proto = s.protocolSection || {};
      const id = proto.identificationModule;
      const status = proto.statusModule;
      const desc = proto.descriptionModule;
      const sponsor = proto.sponsorCollaboratorsModule;
      const design = proto.designModule;
      const conditions = proto.conditionsModule;
      const interventions = proto.armsInterventionsModule;

      const nctId = id?.nctId || '';
      const title = id?.briefTitle || id?.officialTitle || '';
      const summary = desc?.briefSummary || '';
      const startYear = status?.startDateStruct?.date
        ? parseInt(status.startDateStruct.date.substring(0, 4))
        : null;

      const sponsorName = sponsor?.leadSponsor?.name || '';
      const studyType = design?.studyType || '';

      return {
        id: `ct_${nctId}`,
        title: `[${studyType || 'Trial'}] ${title}`,
        authors: sponsorName ? [sponsorName] : [],
        year: startYear,
        abstract: summary,
        source: 'clinical_trials' as const,
        citationCount: undefined,
        doi: undefined,
        url: `https://clinicaltrials.gov/study/${nctId}`,
        journal: `ClinicalTrials.gov • ${status?.overallStatus || ''}`,
      };
    });
  } catch (e) {
    console.error('[ClinicalTrials] Error:', e);
    return [];
  }
}

// ─── Europe PMC (preprints + open access) ───────────────────────────
async function searchEuropePMC(query: string, limit = 10): Promise<Paper[]> {
  try {
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&resultType=core&pageSize=${limit}&format=json`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error('[EuropePMC] Status:', res.status);
      return [];
    }
    const data = await res.json();
    return (data.resultList?.result || []).map((r: any) => {
      const isPreprint = r.source === 'PPR';
      return {
        id: `epmc_${r.id}_${r.source}`,
        title: r.title || '',
        authors: (r.authorList?.author || []).map((a: any) => `${a.firstName || ''} ${a.lastName || ''}`.trim()),
        year: r.pubYear ? parseInt(r.pubYear) : null,
        abstract: r.abstractText || '',
        source: 'europe_pmc' as const,
        citationCount: r.citedByCount,
        doi: r.doi,
        url: r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/${r.source}/${r.id}`,
        journal: isPreprint ? `Preprint • ${r.bookOrReportDetails?.publisher || r.source}` : r.journalTitle,
        openAccess: r.isOpenAccess === 'Y',
      };
    });
  } catch (e) {
    console.error('[EuropePMC] Error:', e);
    return [];
  }
}

// ─── Main handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      query,
      sources = ['semantic_scholar', 'pubmed', 'openalex', 'clinical_trials', 'europe_pmc'],
      limit = 10,
    } = await req.json();

    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[search-papers] Query: "${query}", sources: ${sources.join(',')}, limit: ${limit}`);

    const sourceMap: Record<string, (q: string, l: number) => Promise<Paper[]>> = {
      semantic_scholar: searchSemanticScholar,
      pubmed: searchPubMed,
      openalex: searchOpenAlex,
      clinical_trials: searchClinicalTrials,
      europe_pmc: searchEuropePMC,
    };

    const promises = sources
      .filter((s: string) => sourceMap[s])
      .map((s: string) => sourceMap[s](query, limit));

    const results = await Promise.all(promises);
    const papers = results.flat();

    console.log(`[search-papers] Raw results: ${papers.length} papers from ${sources.length} sources`);

    // Deduplicate by DOI, keeping the one with more info
    const seen = new Map<string, Paper>();
    const unique: Paper[] = [];
    for (const p of papers) {
      const key = p.doi ? p.doi.toLowerCase() : p.id;
      if (!seen.has(key)) {
        seen.set(key, p);
        unique.push(p);
      } else {
        // Keep the one with longer abstract
        const existing = seen.get(key)!;
        if ((p.abstract?.length || 0) > (existing.abstract?.length || 0)) {
          const idx = unique.indexOf(existing);
          if (idx >= 0) unique[idx] = p;
          seen.set(key, p);
        }
      }
    }

    console.log(`[search-papers] After dedup: ${unique.length} unique papers`);

    return new Response(JSON.stringify({
      papers: unique,
      total: unique.length,
      sources_queried: sources,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[search-papers] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
