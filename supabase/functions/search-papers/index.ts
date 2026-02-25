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
  studyType?: string;
}

interface SearchFilters {
  yearMin?: number;
  yearMax?: number;
  openAccessOnly?: boolean;
  studyTypes?: string[];
  minCitations?: number;
}

// ─── Semantic Scholar ───────────────────────────────────────────────
async function searchSemanticScholar(query: string, limit = 10, filters?: SearchFilters): Promise<Paper[]> {
  try {
    let url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,authors,year,abstract,citationCount,externalIds,url,journal,isOpenAccess`;

    // Semantic Scholar supports year range filter
    if (filters?.yearMin || filters?.yearMax) {
      const yearStr = `${filters.yearMin || 1900}-${filters.yearMax || new Date().getFullYear()}`;
      url += `&year=${yearStr}`;
    }

    // Open access filter
    if (filters?.openAccessOnly) {
      url += `&openAccessPdf`;
    }

    // Min citations filter
    if (filters?.minCitations && filters.minCitations > 0) {
      url += `&minCitationCount=${filters.minCitations}`;
    }

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
async function searchPubMed(query: string, limit = 10, filters?: SearchFilters): Promise<Paper[]> {
  try {
    // Build PubMed query with filters
    let pubmedQuery = query;

    // Date range filter using PubMed's date syntax
    if (filters?.yearMin || filters?.yearMax) {
      const minDate = filters.yearMin || 1900;
      const maxDate = filters.yearMax || new Date().getFullYear();
      pubmedQuery += ` AND ${minDate}:${maxDate}[dp]`;
    }

    // Study type filters using PubMed MeSH terms
    if (filters?.studyTypes && filters.studyTypes.length > 0) {
      const meshTerms: string[] = [];
      for (const st of filters.studyTypes) {
        switch (st) {
          case 'review': meshTerms.push('review[pt]'); break;
          case 'meta-analysis': meshTerms.push('meta-analysis[pt]'); break;
          case 'systematic-review': meshTerms.push('systematic review[pt]'); break;
          case 'rct': meshTerms.push('randomized controlled trial[pt]'); break;
          case 'clinical-trial': meshTerms.push('clinical trial[pt]'); break;
          case 'case-report': meshTerms.push('case reports[pt]'); break;
          case 'observational': meshTerms.push('observational study[pt]'); break;
          case 'cohort': meshTerms.push('cohort study[mesh]'); break;
        }
      }
      if (meshTerms.length > 0) {
        pubmedQuery += ` AND (${meshTerms.join(' OR ')})`;
      }
    }

    // Open access filter
    if (filters?.openAccessOnly) {
      pubmedQuery += ' AND free full text[filter]';
    }

    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(pubmedQuery)}&retmax=${limit}&retmode=json&sort=relevance`;
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

    // Extract abstracts and publication types
    const abstracts: Record<string, string> = {};
    const pubTypes: Record<string, string[]> = {};
    const articleBlocks = abstractXml.split('<PubmedArticle>');
    for (const block of articleBlocks) {
      const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
      if (!pmidMatch) continue;
      const pmid = pmidMatch[1];
      
      // Extract abstract
      const textParts: string[] = [];
      const abstractTextRegex = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g;
      let m;
      while ((m = abstractTextRegex.exec(block)) !== null) {
        textParts.push(m[1].replace(/<[^>]+>/g, '').trim());
      }
      if (textParts.length > 0) {
        abstracts[pmid] = textParts.join(' ');
      }

      // Extract publication types
      const types: string[] = [];
      const pubTypeRegex = /<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/g;
      while ((m = pubTypeRegex.exec(block)) !== null) {
        types.push(m[1].trim());
      }
      if (types.length > 0) {
        pubTypes[pmid] = types;
      }
    }

    return ids.map((id) => {
      const item = fetchData.result?.[id];
      if (!item) return null;
      const authors = (item.authors || []).map((a: any) => a.name);
      const pubYear = item.pubdate ? parseInt(item.pubdate.substring(0, 4)) : null;
      const doi = (item.elocationid || '').replace('doi: ', '');
      
      // Determine study type from publication types
      const types = pubTypes[id] || [];
      let studyType = '';
      if (types.some(t => t.toLowerCase().includes('meta-analysis'))) studyType = 'Meta-Analysis';
      else if (types.some(t => t.toLowerCase().includes('systematic review'))) studyType = 'Systematic Review';
      else if (types.some(t => t.toLowerCase().includes('randomized controlled trial'))) studyType = 'RCT';
      else if (types.some(t => t.toLowerCase().includes('review'))) studyType = 'Review';
      else if (types.some(t => t.toLowerCase().includes('clinical trial'))) studyType = 'Clinical Trial';
      else if (types.some(t => t.toLowerCase().includes('case report'))) studyType = 'Case Report';
      else if (types.some(t => t.toLowerCase().includes('observational'))) studyType = 'Observational';

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
        studyType,
      };
    }).filter(Boolean) as Paper[];
  } catch (e) {
    console.error('[PubMed] Error:', e);
    return [];
  }
}

// ─── OpenAlex ───────────────────────────────────────────────────────
async function searchOpenAlex(query: string, limit = 10, filters?: SearchFilters): Promise<Paper[]> {
  try {
    let url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${limit}&select=id,title,authorships,publication_year,abstract_inverted_index,cited_by_count,doi,primary_location,open_access,type&mailto=scholarai@research.app`;

    // Build OpenAlex filter string
    const oaFilters: string[] = [];

    if (filters?.yearMin || filters?.yearMax) {
      const min = filters.yearMin || 1900;
      const max = filters.yearMax || new Date().getFullYear();
      oaFilters.push(`publication_year:${min}-${max}`);
    }

    if (filters?.openAccessOnly) {
      oaFilters.push('open_access.is_oa:true');
    }

    if (filters?.minCitations && filters.minCitations > 0) {
      oaFilters.push(`cited_by_count:>${filters.minCitations - 1}`);
    }

    // Study type mapping for OpenAlex
    if (filters?.studyTypes && filters.studyTypes.length > 0) {
      const oaTypes: string[] = [];
      for (const st of filters.studyTypes) {
        switch (st) {
          case 'review': oaTypes.push('review'); break;
          case 'meta-analysis': oaTypes.push('review'); break;
          case 'rct': case 'clinical-trial': oaTypes.push('article'); break;
          default: oaTypes.push('article'); break;
        }
      }
      if (oaTypes.length > 0) {
        oaFilters.push(`type:${[...new Set(oaTypes)].join('|')}`);
      }
    }

    if (oaFilters.length > 0) {
      url += `&filter=${oaFilters.join(',')}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      console.error('[OpenAlex] Status:', res.status);
      return [];
    }
    const data = await res.json();
    return (data.results || []).map((w: any) => {
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
        studyType: w.type === 'review' ? 'Review' : '',
      };
    });
  } catch (e) {
    console.error('[OpenAlex] Error:', e);
    return [];
  }
}

// ─── ClinicalTrials.gov ─────────────────────────────────────────────
async function searchClinicalTrials(query: string, limit = 10, filters?: SearchFilters): Promise<Paper[]> {
  try {
    let url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(query)}&pageSize=${limit}&fields=NCTId,BriefTitle,OverallStatus,Condition,InterventionName,StartDate,BriefSummary,LeadSponsorName,StudyType&format=json`;

    // Date range filter
    if (filters?.yearMin || filters?.yearMax) {
      const minDate = `${filters.yearMin || 1900}-01-01`;
      const maxDate = `${filters.yearMax || new Date().getFullYear()}-12-31`;
      url += `&query.term=${encodeURIComponent(query)}&filter.advanced=AREA[StartDate]RANGE[${minDate},${maxDate}]`;
    }

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
        studyType: 'Clinical Trial',
      };
    });
  } catch (e) {
    console.error('[ClinicalTrials] Error:', e);
    return [];
  }
}

// ─── Europe PMC ─────────────────────────────────────────────────────
async function searchEuropePMC(query: string, limit = 10, filters?: SearchFilters): Promise<Paper[]> {
  try {
    // Build Europe PMC query with filters
    let epmcQuery = query;

    if (filters?.yearMin || filters?.yearMax) {
      const min = filters.yearMin || 1900;
      const max = filters.yearMax || new Date().getFullYear();
      epmcQuery += ` PUB_YEAR:[${min} TO ${max}]`;
    }

    if (filters?.openAccessOnly) {
      epmcQuery += ' OPEN_ACCESS:y';
    }

    if (filters?.minCitations && filters.minCitations > 0) {
      epmcQuery += ` CITED:y`;
    }

    // Study type filters
    if (filters?.studyTypes && filters.studyTypes.length > 0) {
      const typeTerms: string[] = [];
      for (const st of filters.studyTypes) {
        switch (st) {
          case 'review': typeTerms.push('(SRC:MED AND review[title])'); break;
          case 'meta-analysis': typeTerms.push('(SRC:MED AND meta-analysis[title])'); break;
          case 'systematic-review': typeTerms.push('(SRC:MED AND systematic review[title])'); break;
          case 'rct': typeTerms.push('(SRC:MED AND randomized[title])'); break;
        }
      }
      if (typeTerms.length > 0) {
        epmcQuery += ` AND (${typeTerms.join(' OR ')})`;
      }
    }

    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(epmcQuery)}&resultType=core&pageSize=${limit}&format=json`;
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

// ─── Translate query to English ─────────────────────────────────────
async function translateToEnglish(query: string): Promise<string> {
  const nonEnglishPattern = /[àáâãéêíóôõúüç]|(\b(qual|quais|como|para|pode|causa|entre|sobre|efeito|tratamento|comparado|mulheres|homens|idosos|crianças|estudo|risco|aumenta|reduz|previne)\b)/i;
  if (!nonEnglishPattern.test(query)) return query;

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return query;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Translate the following research question to English. Output ONLY the translated question, nothing else.' },
          { role: 'user', content: query },
        ],
        max_tokens: 200,
      }),
    });
    if (!resp.ok) return query;
    const data = await resp.json();
    const translated = data.choices?.[0]?.message?.content?.trim();
    if (translated) {
      console.log(`[search-papers] Translated: "${query}" → "${translated}"`);
      return translated;
    }
    return query;
  } catch {
    return query;
  }
}

// ─── Main handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      query: originalQuery,
      sources = ['semantic_scholar', 'pubmed', 'openalex', 'clinical_trials', 'europe_pmc'],
      limit = 10,
      filters,
    } = await req.json();

    if (!originalQuery || typeof originalQuery !== 'string') {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse filters
    const searchFilters: SearchFilters | undefined = filters ? {
      yearMin: filters.yearMin,
      yearMax: filters.yearMax,
      openAccessOnly: filters.openAccessOnly,
      studyTypes: filters.studyTypes,
      minCitations: filters.minCitations,
    } : undefined;

    // Translate non-English queries
    const query = await translateToEnglish(originalQuery);

    console.log(`[search-papers] Query: "${query}", sources: ${sources.join(',')}, limit: ${limit}, filters: ${JSON.stringify(searchFilters || {})}`);

    const sourceMap: Record<string, (q: string, l: number, f?: SearchFilters) => Promise<Paper[]>> = {
      semantic_scholar: searchSemanticScholar,
      pubmed: searchPubMed,
      openalex: searchOpenAlex,
      clinical_trials: searchClinicalTrials,
      europe_pmc: searchEuropePMC,
    };

    const promises = sources
      .filter((s: string) => sourceMap[s])
      .map((s: string) => sourceMap[s](query, limit, searchFilters));

    const results = await Promise.all(promises);
    const papers = results.flat();

    console.log(`[search-papers] Raw results: ${papers.length} papers from ${sources.length} sources`);

    // Deduplicate by DOI
    const seen = new Map<string, Paper>();
    const unique: Paper[] = [];
    for (const p of papers) {
      const key = p.doi ? p.doi.toLowerCase() : p.id;
      if (!seen.has(key)) {
        seen.set(key, p);
        unique.push(p);
      } else {
        const existing = seen.get(key)!;
        if ((p.abstract?.length || 0) > (existing.abstract?.length || 0)) {
          const idx = unique.indexOf(existing);
          if (idx >= 0) unique[idx] = p;
          seen.set(key, p);
        }
      }
    }

    // Count papers per source for stats
    const sourceCounts: Record<string, number> = {};
    for (const p of unique) {
      sourceCounts[p.source] = (sourceCounts[p.source] || 0) + 1;
    }

    // Count study types for facets
    const studyTypeCounts: Record<string, number> = {};
    for (const p of unique) {
      if (p.studyType) {
        studyTypeCounts[p.studyType] = (studyTypeCounts[p.studyType] || 0) + 1;
      }
    }

    console.log(`[search-papers] After dedup: ${unique.length} unique papers`);

    return new Response(JSON.stringify({
      papers: unique,
      total: unique.length,
      sources_queried: sources,
      source_counts: sourceCounts,
      study_type_counts: studyTypeCounts,
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
