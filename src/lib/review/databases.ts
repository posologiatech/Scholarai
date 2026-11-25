/**
 * Catalogue of literature sources the review module can search, and how each is reached.
 * Access modes were probed on 2026-11-25 (phase 0 spike); `note` records what was observed.
 *
 *  - integrated: the app queries it directly (edge function search-papers or a new harvester)
 *  - import:     no usable programmatic access; the app generates the search string for the
 *                source's own syntax and the user imports the exported RIS/CSV
 *  - manual:     searched by hand (terms of use forbid automation); the search is logged
 */
export type AccessMode = "integrated" | "import" | "manual";

export type ReviewArea = "health" | "nursing" | "pharmacy" | "psychology" | "education" | "social" | "engineering" | "general";

export interface SourceDef {
  id: string;
  label: string;
  access: AccessMode;
  /** True when the module already has a working connector for it. */
  implemented: boolean;
  areas: ReviewArea[];
  /** Query dialect used when generating the search string. */
  syntax: "pubmed" | "ovid" | "scopus" | "wos" | "ebsco" | "bvs" | "cochrane" | "simple";
  note: string;
}

const HEALTH: ReviewArea[] = ["health", "nursing", "pharmacy", "psychology"];

export const SOURCES: SourceDef[] = [
  { id: "pubmed", label: "PubMed / MEDLINE", access: "integrated", implemented: true, areas: HEALTH, syntax: "pubmed",
    note: "E-utilities respond normally. Supports MeSH and publication-type filters." },
  { id: "europe_pmc", label: "Europe PMC", access: "integrated", implemented: true, areas: HEALTH, syntax: "simple",
    note: "Open API, already connected." },
  { id: "openalex", label: "OpenAlex", access: "integrated", implemented: true, areas: ["general"], syntax: "simple",
    note: "Reachable, but without an API key the free daily budget is shared per IP. High-volume harvesting needs a key (account-level action for the owner). Also gives citation chasing and a SciELO source filter." },
  { id: "semantic_scholar", label: "Semantic Scholar", access: "integrated", implemented: true, areas: ["general"], syntax: "simple",
    note: "Already connected." },
  { id: "crossref", label: "Crossref", access: "integrated", implemented: true, areas: ["general"], syntax: "simple",
    note: "Metadata only; good for completing records." },
  { id: "core", label: "CORE", access: "integrated", implemented: true, areas: ["general"], syntax: "simple",
    note: "Open-access full texts, already connected." },
  { id: "clinical_trials", label: "ClinicalTrials.gov", access: "integrated", implemented: true, areas: HEALTH, syntax: "simple",
    note: "API v2 responds normally. Registered trials and grey literature." },
  { id: "bdtd", label: "BDTD (teses e dissertações)", access: "integrated", implemented: false, areas: ["general"], syntax: "simple",
    note: "Open VuFind API at bdtd.ibict.br answers JSON (12k hits for 'diabetes'). New connector needed; grey literature in Portuguese." },
  { id: "scielo", label: "SciELO", access: "import", implemented: false, areas: ["general", ...HEALTH], syntax: "simple",
    note: "search.scielo.org is behind a bot challenge (HTTP 403 to automated clients). Use export + import, or reach SciELO journals through the OpenAlex source filter." },
  { id: "lilacs", label: "LILACS / BVS", access: "import", implemented: false, areas: HEALTH, syntax: "bvs",
    note: "pesquisa.bvsalud.org is behind the same bot challenge (403). Generate the BVS string, user exports and imports." },
  { id: "cochrane_central", label: "Cochrane CENTRAL", access: "import", implemented: false, areas: HEALTH, syntax: "cochrane",
    note: "cochranelibrary.com blocks automated clients (403 challenge). Export + import." },
  { id: "embase", label: "Embase", access: "import", implemented: false, areas: HEALTH, syntax: "ovid", note: "Licensed; no open API." },
  { id: "scopus", label: "Scopus", access: "import", implemented: false, areas: ["general", ...HEALTH, "engineering", "social", "education"], syntax: "scopus", note: "Licensed." },
  { id: "wos", label: "Web of Science", access: "import", implemented: false, areas: ["general", ...HEALTH, "engineering", "social", "education"], syntax: "wos", note: "Licensed." },
  { id: "cinahl", label: "CINAHL", access: "import", implemented: false, areas: ["nursing", "health"], syntax: "ebsco", note: "Licensed (EBSCO)." },
  { id: "psycinfo", label: "PsycINFO", access: "import", implemented: false, areas: ["psychology", "health", "education"], syntax: "ovid", note: "Licensed (APA)." },
  { id: "eric", label: "ERIC", access: "import", implemented: false, areas: ["education"], syntax: "simple", note: "Not probed in phase 0; default to import." },
  { id: "ictrp", label: "WHO ICTRP", access: "import", implemented: false, areas: HEALTH, syntax: "simple",
    note: "Web search only, no API; the portal offers CSV download. Do not scrape." },
  { id: "rebec", label: "ReBEC", access: "import", implemented: false, areas: HEALTH, syntax: "simple", note: "No API found; import." },
  { id: "capes_teses", label: "Catálogo de Teses CAPES", access: "import", implemented: false, areas: ["general"], syntax: "simple", note: "No public API found; import." },
  { id: "google_scholar", label: "Google Scholar", access: "manual", implemented: false, areas: ["general"], syntax: "simple",
    note: "Terms of use forbid automation. Log the search and import the results by hand." },
];

export type ReviewTypeId = "systematic" | "scoping" | "integrative" | "narrative" | "rapid" | "umbrella" | "qualitative" | "realist";

/**
 * Minimum sets recommended per review type and area. The Cochrane Handbook advises MEDLINE,
 * Embase and CENTRAL as the core trio for intervention reviews; scoping and integrative reviews
 * add grey literature. Expert review in phase 0 may adjust these lists.
 */
const CORE: Record<string, string[]> = {
  health: ["pubmed", "embase", "cochrane_central", "lilacs"],
  pharmacy: ["pubmed", "embase", "cochrane_central", "lilacs"],
  nursing: ["pubmed", "cinahl", "lilacs", "embase"],
  psychology: ["pubmed", "psycinfo", "embase"],
  education: ["eric", "scopus", "wos", "scielo"],
  social: ["scopus", "wos", "scielo"],
  engineering: ["scopus", "wos"],
  general: ["scopus", "wos", "openalex"],
};

const GREY: Record<string, string[]> = {
  health: ["clinical_trials", "ictrp", "bdtd"],
  pharmacy: ["clinical_trials", "ictrp", "bdtd"],
  nursing: ["bdtd", "clinical_trials"],
  psychology: ["bdtd", "clinical_trials"],
  education: ["bdtd"],
  social: ["bdtd"],
  engineering: ["bdtd"],
  general: ["bdtd"],
};

export interface Recommendation {
  source: SourceDef;
  tier: "core" | "complementary";
  why: string;
}

export function recommendSources(type: ReviewTypeId, area: ReviewArea): Recommendation[] {
  const byId = new Map(SOURCES.map((s) => [s.id, s]));
  const out: Recommendation[] = [];
  const add = (id: string, tier: Recommendation["tier"], why: string) => {
    const source = byId.get(id);
    if (source && !out.some((r) => r.source.id === id)) out.push({ source, tier, why });
  };

  for (const id of CORE[area] ?? CORE.general) add(id, "core", "Base principal da área para este tipo de revisão.");

  if (type === "systematic" || type === "umbrella" || type === "rapid") {
    for (const id of GREY[area] ?? []) add(id, "complementary", "Reduz viés de publicação (registros e literatura cinzenta).");
  }
  if (type === "scoping" || type === "integrative" || type === "realist" || type === "qualitative") {
    for (const id of GREY[area] ?? []) add(id, "complementary", "Escopo amplo: inclui literatura cinzenta.");
    add("openalex", "complementary", "Cobertura multidisciplinar aberta e busca por citações.");
    add("europe_pmc", "complementary", "Acesso aberto a texto completo.");
  }
  // Open sources that make every search reproducible without a licence.
  add("openalex", "complementary", "Cobertura aberta e busca por citações (snowballing).");
  return out;
}

export function accessSummary(recs: Recommendation[]): { integrated: number; import: number; manual: number } {
  const n = { integrated: 0, import: 0, manual: 0 };
  for (const r of recs) n[r.source.access]++;
  return n;
}
