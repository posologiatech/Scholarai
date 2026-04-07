import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-caller.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── UF / Region mappings ── */
const REGION_STATES: Record<string, string[]> = {
  norte: ["12", "16", "13", "15", "11", "14", "17"],
  nordeste: ["27", "29", "23", "21", "25", "26", "22", "24", "28"],
  sudeste: ["32", "31", "33", "35"],
  sul: ["41", "43", "42"],
  "centro-oeste": ["53", "52", "51", "50"],
};

const STATE_NAME_TO_IBGE: Record<string, string> = {
  acre: "12", alagoas: "27", amapa: "16", amazonas: "13", bahia: "29",
  ceara: "23", "distrito federal": "53", "espirito santo": "32",
  goias: "52", maranhao: "21", "mato grosso": "51",
  "mato grosso do sul": "50", "minas gerais": "31", para: "15",
  paraiba: "25", parana: "41", pernambuco: "26", piaui: "22",
  "rio de janeiro": "33", "rio grande do norte": "24",
  "rio grande do sul": "43", rondonia: "11", roraima: "14",
  "santa catarina": "42", "sao paulo": "35", sergipe: "28",
  tocantins: "17",
  ac: "12", al: "27", ap: "16", am: "13", ba: "29", ce: "23",
  df: "53", es: "32", go: "52", ma: "21", mt: "51", ms: "50",
  mg: "31", pa: "15", pb: "25", pr: "41", pe: "26", pi: "22",
  rj: "33", rn: "24", rs: "43", ro: "11", rr: "14", sc: "42",
  sp: "35", se: "28", to: "17",
};

const STATE_IBGE_TO_NAME: Record<string, string> = {
  "12": "Acre", "27": "Alagoas", "16": "Amapá", "13": "Amazonas",
  "29": "Bahia", "23": "Ceará", "53": "Distrito Federal", "32": "Espírito Santo",
  "52": "Goiás", "21": "Maranhão", "51": "Mato Grosso", "50": "Mato Grosso do Sul",
  "31": "Minas Gerais", "15": "Pará", "25": "Paraíba", "41": "Paraná",
  "26": "Pernambuco", "22": "Piauí", "33": "Rio de Janeiro", "24": "Rio Grande do Norte",
  "43": "Rio Grande do Sul", "11": "Rondônia", "14": "Roraima", "42": "Santa Catarina",
  "35": "São Paulo", "28": "Sergipe", "17": "Tocantins",
};

/* Capital geocodes for state-level InfoDengue queries */
const STATE_CAPITAL_GEOCODE: Record<string, string> = {
  "12": "1200401", "27": "2704302", "16": "1600303", "13": "1302603",
  "29": "2927408", "23": "2304400", "53": "5300108", "32": "3205309",
  "52": "5208707", "21": "2111300", "51": "5103403", "50": "5002704",
  "31": "3106200", "15": "1501402", "25": "2507507", "41": "4106902",
  "26": "2611606", "22": "2211001", "33": "3304557", "24": "2408102",
  "43": "4314902", "11": "1100205", "14": "1400100", "42": "4205407",
  "35": "3550308", "28": "2800308", "17": "1721000",
};

/* ── Helpers ── */

interface RealDataResult {
  csv: string;
  rowCount: number;
  source: string;
  columnsDescription: string;
  supplementaryCsv?: string;
  supplementaryDescription?: string;
}

interface InfoDengueRecord {
  data_iniSE: string;
  SE: number;
  casos_est: number;
  casos: number;
  nivel: number;
  receptession: number;
  p_rt1: number;
  tempmin: number;
  tempmed: number;
  tempmax: number;
  umidmin: number;
  umidmed: number;
  umidmax: number;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function mapDiseaseToInfoDengue(disease: string): string | null {
  const lower = normalize(disease);
  if (lower.includes("dengue")) return "dengue";
  if (lower.includes("chikungunya") || lower.includes("chik")) return "chikungunya";
  if (lower.includes("zika")) return "zika";
  return null;
}

function parseYears(period: string): { startYear: number; endYear: number } {
  const currentYear = new Date().getFullYear();
  const years = period.match(/\d{4}/g);
  if (years && years.length >= 2) {
    return { startYear: parseInt(years[0]), endYear: parseInt(years[years.length - 1]) };
  }
  if (years && years.length === 1) {
    return { startYear: parseInt(years[0]), endYear: parseInt(years[0]) };
  }
  const lastN = period.match(/(?:últimos?|last)\s+(\d+)\s+anos?/i);
  if (lastN) {
    const n = parseInt(lastN[1]);
    return { startYear: currentYear - n, endYear: currentYear - 1 };
  }
  return { startYear: currentYear - 5, endYear: currentYear - 1 };
}

function resolveStateCodes(location: string): string[] {
  const lower = normalize(location);

  for (const [region, codes] of Object.entries(REGION_STATES)) {
    if (lower.includes(region)) return codes;
  }

  if (lower.includes("brasil") || lower === "br" || lower.includes("todo o pais") || lower.includes("todas")) {
    return Object.keys(STATE_IBGE_TO_NAME);
  }

  for (const [name, code] of Object.entries(STATE_NAME_TO_IBGE)) {
    if (lower.includes(name)) return [code];
  }

  return [];
}

/* ── Topic detection for source routing ── */

type DataTopic = "arbovirus" | "mortality" | "births" | "tuberculosis" | "leprosy" | "srag" | "population" | "demographics" | "other";

function detectTopic(disease: string): DataTopic {
  const d = normalize(disease);
  if (d.includes("dengue") || d.includes("chikungunya") || d.includes("chik") || d.includes("zika")) return "arbovirus";
  if (d.includes("srag") || d.includes("covid") || d.includes("influenza") || d.includes("gripe")
    || d.includes("sindrome respiratoria")) return "srag";
  if (d.includes("mortalidade") || d.includes("obito") || d.includes("morte") || d.includes("mortality")
    || d.includes("cardiovascular") || d.includes("neoplasia") || d.includes("cancer")
    || d.includes("infarto") || d.includes("avc") || d.includes("cerebrovascular")
    || d.includes("mortalidade infantil") || d.includes("infant mortality")
    || d.includes("sim ")) return "mortality";
  if (d.includes("nascimento") || d.includes("nascido") || d.includes("sinasc") || d.includes("natalidade")
    || d.includes("birth") || d.includes("parto")) return "births";
  if (d.includes("tuberculose") || d.includes("tb") || d.includes("tuberculosis")) return "tuberculosis";
  if (d.includes("hanseniase") || d.includes("lepra") || d.includes("leprosy") || d.includes("hansen")) return "leprosy";
  if (d.includes("populacao") || d.includes("habitantes") || d.includes("population")
    || d.includes("demografi") || d.includes("censo")) return "population";
  if (d.includes("pib") || d.includes("idh") || d.includes("gdp") || d.includes("renda")
    || d.includes("socioeconomi")) return "demographics";
  return "other";
}

/** Detect if user wants a comparison/benchmark between regions */
function detectComparison(prompt: string): boolean {
  const p = normalize(prompt);
  return p.includes("compar") || p.includes("benchmark") || p.includes("ranking")
    || p.includes(" vs ") || p.includes(" versus ") || p.includes("diferenca entre")
    || p.includes("relacao entre") || p.includes("correlacao");
}

/** Check if user prompt requires normalization (rates per 100k) */
function requiresNormalization(prompt: string): boolean {
  const p = normalize(prompt);
  return p.includes("taxa") || p.includes("per capita") || p.includes("por 100") || p.includes("100 mil")
    || p.includes("100.000") || p.includes("rate") || p.includes("incidencia") || p.includes("prevalencia");
}

/* ── Available sources definition ── */
const AVAILABLE_SOURCES = [
  { name: "InfoDengue", topics: "Arboviroses (Dengue, Zika, Chikungunya)", period: "2014-2024" },
  { name: "IBGE SIDRA (SIM)", topics: "Mortalidade por causa (CID-10)", period: "2012-2022" },
  { name: "IBGE SIDRA (SINASC)", topics: "Nascidos vivos", period: "2012-2022" },
  { name: "OpenDataSUS", topics: "SRAG / COVID-19 / Influenza", period: "2020-2025" },
  { name: "TabNet/SINAN", topics: "Tuberculose e Hanseníase (notificações)", period: "2012-2023" },
  { name: "IBGE Agregados", topics: "População estimada, PIB per capita", period: "2000-2024" },
];

/* ── InfoDengue API fetcher ── */

async function fetchInfoDengueByState(
  disease: string,
  stateCodes: string[],
  startYear: number,
  endYear: number
): Promise<RealDataResult | null> {
  try {
    const allRecords: Array<{
      ano: number; semana_epi: number; uf: string;
      casos_estimados: number; casos_notificados: number; nivel_alerta: number;
    }> = [];

    const fetchPromises = stateCodes.map(async (stateCode) => {
      const geocode = STATE_CAPITAL_GEOCODE[stateCode];
      if (!geocode) return;
      const stateName = STATE_IBGE_TO_NAME[stateCode] || stateCode;

      for (let year = startYear; year <= endYear; year++) {
        try {
          const url = `https://info.dengue.mat.br/api/alertcity?geocode=${geocode}&disease=${disease}&format=json&ew_start=1&ew_end=52&ey_start=${year}&ey_end=${year}`;
          const resp = await fetch(url, {
            headers: { "Accept": "application/json" },
            signal: AbortSignal.timeout(10000),
          });
          if (!resp.ok) continue;
          const data: InfoDengueRecord[] = await resp.json();
          for (const rec of data) {
            const se = String(rec.SE);
            const ano = parseInt(se.substring(0, 4));
            const semana = parseInt(se.substring(4));
            allRecords.push({
              ano, semana_epi: semana, uf: stateName,
              casos_estimados: Math.round(rec.casos_est || 0),
              casos_notificados: rec.casos || 0,
              nivel_alerta: rec.nivel || 0,
            });
          }
        } catch (e) {
          console.warn(`InfoDengue fetch failed for ${stateCode}/${year}:`, e);
        }
      }
    });

    await Promise.all(fetchPromises);
    if (allRecords.length === 0) return null;

    allRecords.sort((a, b) => a.ano - b.ano || a.semana_epi - b.semana_epi || a.uf.localeCompare(b.uf));

    const csvLines = ["ano,semana_epi,uf,casos_estimados,casos_notificados,nivel_alerta"];
    for (const r of allRecords) {
      csvLines.push(`${r.ano},${r.semana_epi},${r.uf},${r.casos_estimados},${r.casos_notificados},${r.nivel_alerta}`);
    }

    return {
      csv: csvLines.join("\n"),
      rowCount: allRecords.length,
      source: "InfoDengue (info.dengue.mat.br) — dados reais de vigilância epidemiológica",
      columnsDescription: `- ano: ano da semana epidemiológica
- semana_epi: número da semana epidemiológica
- uf: nome do estado (capital como proxy)
- casos_estimados: casos estimados pelo modelo (nowcasting)
- casos_notificados: casos oficialmente notificados
- nivel_alerta: nível de alerta (1=verde, 2=amarelo, 3=laranja, 4=vermelho)`,
    };
  } catch (e) {
    console.error("InfoDengue fetch error:", e);
    return null;
  }
}

/* ── IBGE SIDRA API fetcher ── */

async function fetchIBGESidra(
  topic: "mortality" | "births",
  stateCodes: string[],
  startYear: number,
  endYear: number,
  diseaseHint: string
): Promise<RealDataResult | null> {
  try {
    const tableId = topic === "mortality" ? "2681" : "2612";
    const years = [];
    for (let y = startYear; y <= endYear; y++) years.push(y);
    const periodParam = years.join(",");

    const allStateKeys = Object.keys(STATE_IBGE_TO_NAME);
    const isAll = stateCodes.length >= allStateKeys.length;
    const ufParam = isAll ? "all" : stateCodes.join(",");

    let url: string;
    if (topic === "mortality") {
      url = `https://apisidra.ibge.gov.br/values/t/2681/n3/${ufParam}/p/${periodParam}/v/93/c2/6794`;
    } else {
      url = `https://apisidra.ibge.gov.br/values/t/2612/n3/${ufParam}/p/${periodParam}/v/9324`;
    }

    console.log(`IBGE SIDRA fetch: ${url}`);

    const resp = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      console.warn(`SIDRA returned ${resp.status}`);
      return null;
    }

    const rawData = await resp.json();
    if (!Array.isArray(rawData) || rawData.length < 2) return null;

    const rows = rawData.slice(1);

    if (topic === "mortality") {
      const csvLines = ["ano,uf,obitos"];
      for (const row of rows) {
        const year = row["D2N"] || row["D3N"] || "";
        const state = row["D1N"] || row["D4N"] || "";
        const value = row["V"] || "0";
        if (year && state && value !== "...") {
          csvLines.push(`${year},"${state}",${value.replace(/\./g, "")}`);
        }
      }
      if (csvLines.length < 2) return null;
      return {
        csv: csvLines.join("\n"),
        rowCount: csvLines.length - 1,
        source: `IBGE SIDRA (tabela ${tableId}) — dados reais do Sistema de Informação sobre Mortalidade (SIM)`,
        columnsDescription: `- ano: ano de referência
- uf: Unidade da Federação
- obitos: total de óbitos registrados`,
      };
    } else {
      const csvLines = ["ano,uf,nascidos_vivos"];
      for (const row of rows) {
        const year = row["D2N"] || row["D3N"] || "";
        const state = row["D1N"] || row["D4N"] || "";
        const value = row["V"] || "0";
        if (year && state && value !== "...") {
          csvLines.push(`${year},"${state}",${value.replace(/\./g, "")}`);
        }
      }
      if (csvLines.length < 2) return null;
      return {
        csv: csvLines.join("\n"),
        rowCount: csvLines.length - 1,
        source: `IBGE SIDRA (tabela ${tableId}) — dados reais do SINASC (Nascidos Vivos)`,
        columnsDescription: `- ano: ano de referência
- uf: Unidade da Federação
- nascidos_vivos: total de nascidos vivos registrados`,
      };
    }
  } catch (e) {
    console.error("IBGE SIDRA fetch error:", e);
    return null;
  }
}

/* ── IBGE SIDRA mortality by CID ── */

async function fetchMortalityByCID(
  cidRange: string,
  stateCodes: string[],
  startYear: number,
  endYear: number,
  diseaseName: string
): Promise<RealDataResult | null> {
  try {
    const years = [];
    for (let y = startYear; y <= endYear; y++) years.push(y);
    const periodParam = years.join(",");
    const allStateKeys = Object.keys(STATE_IBGE_TO_NAME);
    const isAll = stateCodes.length >= allStateKeys.length;
    const ufParam = isAll ? "all" : stateCodes.join(",");

    const url = `https://apisidra.ibge.gov.br/values/t/2681/n3/${ufParam}/p/${periodParam}/v/93/c2/6794/c58/2`;
    console.log(`SIDRA CID fetch: ${url}`);

    const resp = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      console.warn(`SIDRA CID returned ${resp.status}`);
      return null;
    }

    const rawData = await resp.json();
    if (!Array.isArray(rawData) || rawData.length < 2) return null;

    const rows = rawData.slice(1);
    const csvLines = [`ano,uf,obitos_doencas_infecciosas`];
    for (const row of rows) {
      const year = row["D2N"] || row["D3N"] || "";
      const state = row["D1N"] || row["D4N"] || "";
      const value = row["V"] || "0";
      if (year && state && value !== "...") {
        csvLines.push(`${year},"${state}",${value.replace(/\./g, "")}`);
      }
    }
    if (csvLines.length < 2) return null;

    return {
      csv: csvLines.join("\n"),
      rowCount: csvLines.length - 1,
      source: `IBGE SIDRA (tabela 2681, Cap. I CID-10) — dados reais de mortalidade por doenças infecciosas e parasitárias (inclui ${diseaseName})`,
      columnsDescription: `- ano: ano de referência
- uf: Unidade da Federação
- obitos_doencas_infecciosas: óbitos por doenças infecciosas e parasitárias (Cap. I CID-10, inclui ${diseaseName})
Nota: Estes são dados de MORTALIDADE do SIM.`,
    };
  } catch (e) {
    console.error("SIDRA CID fetch error:", e);
    return null;
  }
}

/* ── OpenDataSUS SRAG Elasticsearch fetcher ── */

async function fetchOpenDataSUSSRAG(
  stateCodes: string[],
  startYear: number,
  endYear: number
): Promise<RealDataResult | null> {
  try {
    const stateNames = stateCodes.map(c => STATE_IBGE_TO_NAME[c]).filter(Boolean);
    const allStates = stateCodes.length >= Object.keys(STATE_IBGE_TO_NAME).length;

    const indexPatterns = ["desc-srag-2021-*", "desc-srag-2020-*"];
    let allRows: Array<{ ano: number; uf: string; casos: number; obitos: number }> = [];

    for (const idx of indexPatterns) {
      try {
        const esUrl = `https://elasticsearch-saps.saude.gov.br/${idx}/_search`;
        const query: any = {
          size: 0,
          query: {
            bool: {
              must: [
                { range: { DT_NOTIFIC: { gte: `${startYear}-01-01`, lte: `${endYear}-12-31` } } },
              ],
            },
          },
          aggs: {
            by_year: {
              date_histogram: { field: "DT_NOTIFIC", calendar_interval: "year", format: "yyyy" },
              aggs: {
                by_uf: {
                  terms: { field: "SG_UF_NOT.keyword", size: 50 },
                  aggs: {
                    obitos: {
                      filter: { term: { EVOLUCAO: 2 } },
                    },
                  },
                },
              },
            },
          },
        };

        if (!allStates && stateNames.length > 0) {
          const ufCodes = stateCodes.map(c => {
            for (const [name, code] of Object.entries(STATE_NAME_TO_IBGE)) {
              if (code === c) return name.length === 2 ? name.toUpperCase() : "";
            }
            return "";
          }).filter(Boolean);
          if (ufCodes.length > 0) {
            query.query.bool.must.push({ terms: { "SG_UF_NOT.keyword": ufCodes } });
          }
        }

        console.log(`OpenDataSUS SRAG fetch: ${esUrl}`);
        const resp = await fetch(esUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(query),
          signal: AbortSignal.timeout(15000),
        });

        if (!resp.ok) {
          console.warn(`OpenDataSUS SRAG returned ${resp.status}`);
          continue;
        }

        const data = await resp.json();
        const yearBuckets = data?.aggregations?.by_year?.buckets || [];

        for (const yBucket of yearBuckets) {
          const year = parseInt(yBucket.key_as_string);
          const ufBuckets = yBucket.by_uf?.buckets || [];
          for (const uBucket of ufBuckets) {
            allRows.push({
              ano: year,
              uf: uBucket.key,
              casos: uBucket.doc_count || 0,
              obitos: uBucket.obitos?.doc_count || 0,
            });
          }
        }
      } catch (innerErr) {
        console.warn(`SRAG index ${idx} fetch failed:`, innerErr);
      }
    }

    if (allRows.length === 0) return null;

    allRows.sort((a, b) => a.ano - b.ano || a.uf.localeCompare(b.uf));
    const csvLines = ["ano,uf,casos_srag,obitos_srag"];
    for (const r of allRows) {
      csvLines.push(`${r.ano},${r.uf},${r.casos},${r.obitos}`);
    }

    return {
      csv: csvLines.join("\n"),
      rowCount: allRows.length,
      source: "OpenDataSUS (Elasticsearch SRAG) — dados reais de Síndrome Respiratória Aguda Grave",
      columnsDescription: `- ano: ano de notificação
- uf: sigla da UF de notificação
- casos_srag: total de casos de SRAG notificados
- obitos_srag: total de óbitos entre casos de SRAG (evolução = óbito)
Nota: Inclui COVID-19, Influenza e outros vírus respiratórios.`,
    };
  } catch (e) {
    console.error("OpenDataSUS SRAG fetch error:", e);
    return null;
  }
}

/* ── TabNet SINAN scraper ── */

const TABNET_DISEASE_CONFIG: Record<string, { defFile: string; diseaseName: string }> = {
  tuberculosis: { defFile: "sinannet/cnv/tubercbrn.def", diseaseName: "Tuberculose" },
  leprosy: { defFile: "sinannet/cnv/hansbrn.def", diseaseName: "Hanseníase" },
};

const STATE_IBGE_TO_TABNET_INDEX: Record<string, string> = {
  "12": "1", "27": "2", "16": "3", "13": "4", "29": "5", "23": "6", "53": "7",
  "32": "8", "52": "9", "21": "10", "51": "11", "50": "12", "31": "13", "15": "14",
  "25": "15", "41": "16", "26": "17", "22": "18", "33": "19", "24": "20",
  "43": "21", "11": "22", "14": "23", "42": "24", "35": "25", "28": "26", "17": "27",
};

async function fetchTabNetSINAN(
  topic: "tuberculosis" | "leprosy",
  stateCodes: string[],
  startYear: number,
  endYear: number
): Promise<RealDataResult | null> {
  try {
    const config = TABNET_DISEASE_CONFIG[topic];
    if (!config) return null;

    const tabnetUrl = "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?" + config.defFile;
    const allStates = stateCodes.length >= Object.keys(STATE_IBGE_TO_NAME).length;

    const formParams = new URLSearchParams();
    formParams.set("Linha", "Unidade_da_Federa%E7%E3o");
    formParams.set("Coluna", "Ano_Diagn%F3stico");
    formParams.set("Incremento", "Casos_confirmados");
    formParams.set("pesqmes1", "Digite+o+texto+e+ache+f%E1cil");
    formParams.set("SMession", "");
    formParams.set("SRession", "");
    formParams.set("SPagession", "");

    for (let y = startYear; y <= endYear; y++) {
      formParams.append("Arquivos", `${config.defFile.split("/").pop()?.replace(".def", "")}${String(y).slice(2)}.dbf`);
    }

    console.log(`TabNet SINAN fetch: ${tabnetUrl}`);
    const resp = await fetch(tabnetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html",
        "User-Agent": "Mozilla/5.0",
      },
      body: formParams.toString(),
      signal: AbortSignal.timeout(20000),
    });

    if (!resp.ok) {
      console.warn(`TabNet returned ${resp.status}`);
      return null;
    }

    const html = await resp.text();
    return parseTabNetHtml(html, stateCodes, allStates, config.diseaseName, topic);
  } catch (e) {
    console.error(`TabNet SINAN fetch error (${topic}):`, e);
    return null;
  }
}

function parseTabNetHtml(
  html: string,
  stateCodes: string[],
  allStates: boolean,
  diseaseName: string,
  topic: string
): RealDataResult | null {
  try {
    const tableMatch = html.match(/<table[^>]*class="tabdados"[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) {
      console.warn("TabNet: no tabdados table found");
      return null;
    }

    const tableHtml = tableMatch[1];

    const headerMatch = tableHtml.match(/<tr[^>]*>\s*<th[^>]*>.*?<\/th>([\s\S]*?)<\/tr>/i);
    if (!headerMatch) return null;

    const yearHeaders: string[] = [];
    const thRegex = /<th[^>]*>(.*?)<\/th>/gi;
    let thMatch;
    while ((thMatch = thRegex.exec(headerMatch[1])) !== null) {
      const val = thMatch[1].replace(/<[^>]+>/g, "").trim();
      if (/^\d{4}$/.test(val)) yearHeaders.push(val);
    }

    if (yearHeaders.length === 0) return null;

    const rows: Array<{ uf: string; values: Record<string, number> }> = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    while ((trMatch = trRegex.exec(tableHtml)) !== null) {
      const rowHtml = trMatch[1];
      if (rowHtml.includes("<th")) continue;

      const cells: string[] = [];
      const tdRegex = /<td[^>]*>(.*?)<\/td>/gi;
      let tdMatch;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        cells.push(tdMatch[1].replace(/<[^>]+>/g, "").trim());
      }

      if (cells.length < 2) continue;
      const ufName = cells[0];
      if (ufName.toLowerCase() === "total" || ufName === "") continue;

      const values: Record<string, number> = {};
      for (let i = 0; i < yearHeaders.length && i + 1 < cells.length; i++) {
        const rawVal = cells[i + 1].replace(/\./g, "").replace(/-/g, "0").trim();
        values[yearHeaders[i]] = parseInt(rawVal) || 0;
      }

      rows.push({ uf: ufName, values });
    }

    if (rows.length === 0) return null;

    let filteredRows = rows;
    if (!allStates) {
      const requestedNames = new Set(stateCodes.map(c => normalize(STATE_IBGE_TO_NAME[c] || "")));
      filteredRows = rows.filter(r => requestedNames.has(normalize(r.uf)));
    }

    if (filteredRows.length === 0) filteredRows = rows;

    const csvLines = [`ano,uf,casos_${topic}`];
    for (const row of filteredRows) {
      for (const [year, count] of Object.entries(row.values)) {
        csvLines.push(`${year},"${row.uf}",${count}`);
      }
    }

    if (csvLines.length < 2) return null;

    return {
      csv: csvLines.join("\n"),
      rowCount: csvLines.length - 1,
      source: `TabNet/SINAN (DataSUS) — dados reais de notificação de ${diseaseName}`,
      columnsDescription: `- ano: ano do diagnóstico/notificação
- uf: Unidade da Federação
- casos_${topic}: casos confirmados de ${diseaseName} notificados ao SINAN
Nota: Estes são dados de NOTIFICAÇÃO (casos), não de mortalidade.`,
    };
  } catch (e) {
    console.error("TabNet HTML parse error:", e);
    return null;
  }
}

/* ── IBGE Agregados API fetcher ── */

async function fetchIBGEAgregados(
  tableId: string,
  variableId: string,
  stateCodes: string[],
  startYear: number,
  endYear: number,
  metricName: string
): Promise<RealDataResult | null> {
  try {
    const allStateKeys = Object.keys(STATE_IBGE_TO_NAME);
    const isAll = stateCodes.length >= allStateKeys.length;

    // Build period param
    const years = [];
    for (let y = startYear; y <= endYear; y++) years.push(y);
    const periodParam = years.join("|");

    // Build locality param  
    const localityParam = isAll ? "N3" : `N3[${stateCodes.join(",")}]`;

    const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${tableId}/periodos/${periodParam}/variaveis/${variableId}?localidades=${localityParam}`;
    console.log(`IBGE Agregados fetch: ${url}`);

    const resp = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      console.warn(`IBGE Agregados returned ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const variable = data[0];
    const results = variable?.resultados;
    if (!results || results.length === 0) return null;

    const csvLines = [`ano,uf,${metricName}`];

    for (const result of results) {
      const series = result.series || [];
      for (const s of series) {
        const ufName = s.localidade?.nome || "";
        const seriesData = s.serie || {};
        for (const [year, value] of Object.entries(seriesData)) {
          if (value && value !== "..." && value !== "-") {
            csvLines.push(`${year},"${ufName}",${String(value).replace(/\./g, "")}`);
          }
        }
      }
    }

    if (csvLines.length < 2) return null;

    return {
      csv: csvLines.join("\n"),
      rowCount: csvLines.length - 1,
      source: `IBGE Agregados (tabela ${tableId}) — dados reais`,
      columnsDescription: `- ano: ano de referência
- uf: Unidade da Federação
- ${metricName}: valor da variável`,
    };
  } catch (e) {
    console.error("IBGE Agregados fetch error:", e);
    return null;
  }
}

/** Fetch population data for normalization (supplementary) */
async function fetchPopulationData(
  stateCodes: string[],
  startYear: number,
  endYear: number
): Promise<RealDataResult | null> {
  // Table 6579 = População residente estimada, Variable 9324
  return await fetchIBGEAgregados("6579", "9324", stateCodes, startYear, endYear, "populacao_estimada");
}

/* ── Source Router ── */

async function fetchRealData(
  disease: string,
  location: string,
  period: string,
  userPrompt: string
): Promise<RealDataResult | null> {
  const topic = detectTopic(disease);
  const stateCodes = resolveStateCodes(location);
  if (stateCodes.length === 0) return null;
  const { startYear, endYear } = parseYears(period);

  console.log(`Source router: topic=${topic}, states=${stateCodes.length}, years=${startYear}-${endYear}`);

  let result: RealDataResult | null = null;

  switch (topic) {
    case "arbovirus": {
      const infoDengueDisease = mapDiseaseToInfoDengue(disease);
      if (infoDengueDisease) {
        result = await fetchInfoDengueByState(infoDengueDisease, stateCodes, startYear, endYear);
      }
      break;
    }
    case "srag": {
      result = await fetchOpenDataSUSSRAG(stateCodes, startYear, endYear);
      break;
    }
    case "mortality": {
      result = await fetchIBGESidra("mortality", stateCodes, startYear, endYear, disease);
      break;
    }
    case "births": {
      result = await fetchIBGESidra("births", stateCodes, startYear, endYear, disease);
      break;
    }
    case "tuberculosis": {
      const tabnetData = await fetchTabNetSINAN("tuberculosis", stateCodes, startYear, endYear);
      if (tabnetData) { result = tabnetData; break; }
      console.log("TabNet TB failed, falling back to SIDRA mortality");
      result = await fetchMortalityByCID("A15-A19", stateCodes, startYear, endYear, "Tuberculose");
      break;
    }
    case "leprosy": {
      const tabnetData = await fetchTabNetSINAN("leprosy", stateCodes, startYear, endYear);
      if (tabnetData) { result = tabnetData; break; }
      console.log("TabNet Leprosy failed, falling back to SIDRA mortality");
      result = await fetchMortalityByCID("A30", stateCodes, startYear, endYear, "Hanseníase");
      break;
    }
    case "population": {
      result = await fetchIBGEAgregados("6579", "9324", stateCodes, startYear, endYear, "populacao_estimada");
      if (result) {
        result.source = "IBGE Agregados (tabela 6579) — População residente estimada";
        result.columnsDescription = `- ano: ano de referência
- uf: Unidade da Federação
- populacao_estimada: população residente estimada`;
      }
      break;
    }
    case "demographics": {
      // PIB per capita: table 5938, variable 37
      result = await fetchIBGEAgregados("5938", "37", stateCodes, startYear, endYear, "pib_per_capita");
      if (result) {
        result.source = "IBGE Agregados (tabela 5938) — PIB per capita";
        result.columnsDescription = `- ano: ano de referência
- uf: Unidade da Federação
- pib_per_capita: PIB per capita em reais`;
      }
      break;
    }
    default:
      return null;
  }

  // Auto-attach population data for normalization or comparison
  const needsPop = requiresNormalization(userPrompt) || detectComparison(userPrompt);
  if (result && needsPop && topic !== "population" && topic !== "demographics") {
    console.log("Auto-fetching population data for normalization/comparison");
    const popData = await fetchPopulationData(stateCodes, startYear, endYear);
    if (popData) {
      result.supplementaryCsv = popData.csv;
      result.supplementaryDescription = `\n\n## DADOS SUPLEMENTARES (População para normalização/comparação)\n${popData.columnsDescription}\n\nUse esses dados para calcular taxas por 100 mil habitantes ou para comparação entre regiões fazendo merge por UF e ano.`;
    }
  }

  // Auto-attach PIB data for socioeconomic comparisons
  if (result && detectComparison(userPrompt) && topic !== "demographics") {
    console.log("Auto-fetching PIB data for benchmarking");
    const pibData = await fetchIBGEAgregados("5938", "37", stateCodes, startYear, endYear, "pib_per_capita");
    if (pibData) {
      const existingSupp = result.supplementaryCsv || "";
      const existingDesc = result.supplementaryDescription || "";
      if (existingSupp) {
        result.supplementaryCsv = existingSupp + "\n\n### PIB_DATA_CSV ###\n" + pibData.csv;
        result.supplementaryDescription = existingDesc + `\n\n## DADOS SOCIOECONÔMICOS (PIB per capita)\n${pibData.columnsDescription}\n\nCarregue como df_pib e faça merge por UF e ano para correlação.`;
      } else {
        result.supplementaryCsv = pibData.csv;
        result.supplementaryDescription = `\n\n## DADOS SOCIOECONÔMICOS (PIB per capita)\n${pibData.columnsDescription}\n\nUse para correlação socioeconômica.`;
      }
    }
  }

  return result;
}

/* ── Dynamic analysis prompt builder ── */

function buildAnalysisPrompt(realData: RealDataResult) {
  let prompt = `Você é um especialista em epidemiologia brasileira. Gere código Python para analisar dados REAIS do DataSUS.

## DADOS REAIS DISPONÍVEIS
Os dados reais já estão carregados. O código DEVE começar com:
\`\`\`python
import pandas as pd
import io

REAL_DATA_CSV = """${realData.csv.substring(0, 50000)}"""

df = pd.read_csv(io.StringIO(REAL_DATA_CSV))
\`\`\`

## Colunas disponíveis:
${realData.columnsDescription}
`;

  if (realData.supplementaryCsv) {
    prompt += `

## DADOS SUPLEMENTARES (População)
Carregue também os dados de população para normalização:
\`\`\`python
POP_DATA_CSV = """${realData.supplementaryCsv.substring(0, 30000)}"""

df_pop = pd.read_csv(io.StringIO(POP_DATA_CSV))
\`\`\`
${realData.supplementaryDescription || ""}
`;
  }

  prompt += `

## Regras:
1. Use SEMPRE f-strings para formatação (NUNCA use .format())
2. Use pandas para manipulação e agregação
3. Use matplotlib/seaborn para gráficos com plt.show()
4. Imprima dados tabulares com print() e show_table(df, "titulo")
5. Sempre inclua tratamento de erros com try/except
6. Crie visualizações claras com títulos em português
7. Use variáveis intermediárias para textos longos
8. Ao final, imprima uma interpretação epidemiológica dos resultados
9. Fonte dos dados: ${realData.source}
10. IMPORTANTE: Estes são dados REAIS. Mencione isso na interpretação.
11. Para agregação anual, some os valores por ano e UF
12. Configure matplotlib para fontes sem serifa: plt.rcParams['font.family'] = 'DejaVu Sans'
`;

  return prompt;
}

/* ── System prompts ── */
const EXTRACTION_PROMPT = `Você é um especialista em epidemiologia brasileira. Interprete a pergunta do usuário e extraia os parâmetros para consulta ao DataSUS.

FONTES DE DADOS DISPONÍVEIS (APENAS estas):
- InfoDengue: arboviroses (Dengue, Zika, Chikungunya) — 2014-2024
- IBGE SIDRA (SIM): mortalidade por causa CID-10 — 2012-2022
- IBGE SIDRA (SINASC): nascidos vivos — 2012-2022
- OpenDataSUS: SRAG/COVID-19/Influenza — 2020-2025
- TabNet/SINAN: Tuberculose e Hanseníase (notificações) — 2012-2023
- IBGE Agregados: População estimada e PIB per capita — 2000-2024

Se a pergunta do usuário se referir a dados que NÃO estão nas fontes acima (por exemplo: saneamento, SNIS, dados municipais detalhados, doenças não listadas como malária, HIV, leishmaniose, etc.), você deve retornar uma explicação informando que esses dados não estão disponíveis neste sistema.

Mapeamento de UFs (código IBGE):
AC:12, AL:27, AP:16, AM:13, BA:29, CE:23, DF:53, ES:32, GO:52, MA:21, MT:51, MS:50, MG:31, PA:15, PB:25, PR:41, PE:26, PI:22, RJ:33, RN:24, RS:43, RO:11, RR:14, SC:42, SP:35, SE:28, TO:17

Regiões: Norte, Nordeste, Sudeste, Sul, Centro-Oeste

CID-10 comuns:
A90:Dengue, A91:Dengue hemorrágica, A92.0:Chikungunya, A15:Tuberculose, A30:Hanseníase, U07.1:COVID-19
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuth(req, corsHeaders);
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    const { messages, query } = await req.json();

    if (!messages && !query) {
      return new Response(
        JSON.stringify({ error: "messages or query required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chatMessages = messages || [{ role: "user", content: query }];

    /* ── Step 1: Extract parameters via AI ── */
    let params: Record<string, any> | null = null;

    try {
      const extractionResponse = await callAI({
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          ...chatMessages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_query_params",
              description: "Extrai parâmetros da pergunta do usuário sobre dados epidemiológicos do DataSUS.",
              parameters: {
                type: "object",
                properties: {
                  explanation: {
                    type: "string",
                    description: "Explicação breve sobre o que será analisado",
                  },
                  data_source: {
                    type: "string",
                    enum: ["SINAN", "SIM", "SINASC", "SIH", "SIA", "IBGE_AGREGADOS"],
                    description: "Sistema de informação do DataSUS ou IBGE",
                  },
                  disease_or_topic: {
                    type: "string",
                    description: "Agravo, doença ou tópico (ex: dengue, tuberculose, mortalidade infantil, população, PIB)",
                  },
                  location: {
                    type: "string",
                    description: "Localidade: UF, município, região ou Brasil",
                  },
                  period: {
                    type: "string",
                    description: "Período de análise (ex: 2017-2023, últimos 5 anos)",
                  },
                  is_unavailable: {
                    type: "boolean",
                    description: "true se os dados solicitados NÃO estão disponíveis nas fontes integradas",
                  },
                  unavailable_reason: {
                    type: "string",
                    description: "Motivo pelo qual os dados não estão disponíveis (se is_unavailable=true)",
                  },
                },
                required: ["explanation", "data_source", "disease_or_topic"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_query_params" } },
        _userId: userId,
        _promptType: "datasus-query",
      } as any);

      if (extractionResponse.ok) {
        const extractionData = await extractionResponse.json();
        const toolCall = extractionData.choices?.[0]?.message?.tool_calls?.[0];

        if (toolCall) {
          params = JSON.parse(toolCall.function.arguments);
        } else {
          const textContent = extractionData.choices?.[0]?.message?.content || "";
          const fencedJson = textContent.match(/```json\s*([\s\S]*?)```/i)?.[1];
          const jsonStart = textContent.indexOf("{");
          const jsonEnd = textContent.lastIndexOf("}");
          const rawJson = fencedJson || (jsonStart !== -1 && jsonEnd > jsonStart ? textContent.slice(jsonStart, jsonEnd + 1) : "");
          if (rawJson) {
            params = JSON.parse(rawJson);
          }
        }
      } else {
        const status = extractionResponse.status;
        if (status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos de IA esgotados." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.warn(`[datasus-query] Tool-call extraction failed (${status}), trying plain JSON fallback`);
      }
    } catch (extractionErr) {
      console.warn("[datasus-query] Tool-call extraction error, trying fallback:", extractionErr);
    }

    if (!params) {
      const fallbackResponse = await callAI({
        messages: [
          {
            role: "system",
            content: EXTRACTION_PROMPT + "\n\nRetorne APENAS um objeto JSON válido com as chaves: explanation, data_source, disease_or_topic, location, period, is_unavailable, unavailable_reason.",
          },
          ...chatMessages,
        ],
        _userId: userId,
        _promptType: "datasus-query",
      } as any);

      if (!fallbackResponse.ok) {
        const status = fallbackResponse.status;
        if (status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos de IA esgotados." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const errText = await fallbackResponse.text().catch(() => "unknown");
        console.error(`[datasus-query] Extraction fallback failed (${status}): ${errText}`);
        return new Response(
          JSON.stringify({ error: "Falha ao processar a consulta. Tente novamente em alguns instantes." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fallbackData = await fallbackResponse.json();
      const textContent = fallbackData.choices?.[0]?.message?.content || "";
      const fencedJson = textContent.match(/```json\s*([\s\S]*?)```/i)?.[1];
      const jsonStart = textContent.indexOf("{");
      const jsonEnd = textContent.lastIndexOf("}");
      const rawJson = fencedJson || (jsonStart !== -1 && jsonEnd > jsonStart ? textContent.slice(jsonStart, jsonEnd + 1) : "");

      if (!rawJson) {
        return new Response(
          JSON.stringify({ type: "text", content: textContent || "Não foi possível interpretar sua pergunta. Tente reformular." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      params = JSON.parse(rawJson);
    }

    const { explanation, data_source, disease_or_topic, location, period, is_unavailable, unavailable_reason } = params;
    const locationStr = location || "Brasil";
    const periodStr = period || "últimos 5 anos";

    /* ── Check if AI flagged as unavailable ── */
    if (is_unavailable) {
      return new Response(
        JSON.stringify({
          type: "unavailable",
          explanation: unavailable_reason || explanation,
          available_sources: AVAILABLE_SOURCES,
          suggestion: "Tente reformular usando um dos temas disponíveis: arboviroses, mortalidade, nascidos vivos, SRAG/COVID, tuberculose, hanseníase, população ou PIB per capita.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    /* ── Step 2: Try to fetch real data via source router ── */
    const userQuestion = chatMessages[chatMessages.length - 1]?.content || "";
    const realData = await fetchRealData(disease_or_topic, locationStr, periodStr, userQuestion);

    if (!realData) {
      console.log(`No real data available for: ${disease_or_topic} / ${locationStr} / ${periodStr}`);
      return new Response(
        JSON.stringify({
          type: "unavailable",
          explanation: `Não foi possível obter dados reais para "${disease_or_topic}" em "${locationStr}" (${periodStr}). Esta informação pode não estar disponível nas fontes integradas ao sistema, ou a fonte pode estar temporariamente inacessível.`,
          available_sources: AVAILABLE_SOURCES,
          suggestion: "Tente reformular usando um dos temas disponíveis: arboviroses (dengue, zika, chikungunya), mortalidade por causa, nascidos vivos, SRAG/COVID/influenza, tuberculose, hanseníase, população estimada ou PIB per capita.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Real data fetched: source=${realData.source}, rows=${realData.rowCount}`);

    /* ── Step 3: Generate analysis code ── */
    const codeGenerationPrompt = buildAnalysisPrompt(realData);

    // Try with tool_choice first, fall back to plain prompt if unsupported
    let pythonCode = "";
    
    try {
      const codeResponse = await callAI({
        messages: [
          { role: "system", content: codeGenerationPrompt },
          { role: "user", content: `Pergunta do pesquisador: ${userQuestion}\n\nParâmetros:\n- Fonte: ${data_source}\n- Agravo/tema: ${disease_or_topic}\n- Local: ${locationStr}\n- Período: ${periodStr}\n\nGere o código Python completo para análise e visualização.` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_analysis_code",
              description: "Gera código Python para analisar dados epidemiológicos.",
              parameters: {
                type: "object",
                properties: {
                  python_code: {
                    type: "string",
                    description: "Código Python completo para análise e visualização dos dados.",
                  },
                },
                required: ["python_code"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_analysis_code" } },
        _userId: userId,
        _promptType: "datasus-analysis",
      } as any);

      if (codeResponse.ok) {
        const codeData = await codeResponse.json();
        const codeToolCall = codeData.choices?.[0]?.message?.tool_calls?.[0];
        if (codeToolCall) {
          const codeArgs = JSON.parse(codeToolCall.function.arguments);
          pythonCode = codeArgs.python_code;
        } else {
          const content = codeData.choices?.[0]?.message?.content || "";
          const codeMatch = content.match(/```python\n?([\s\S]*?)```/);
          pythonCode = codeMatch ? codeMatch[1] : content;
        }
      } else {
        console.warn(`[datasus-query] Tool-call code generation failed (${codeResponse.status}), trying plain prompt fallback`);
      }
    } catch (toolErr) {
      console.warn("[datasus-query] Tool-call code generation error, trying fallback:", toolErr);
    }

    // Fallback: plain prompt without tool_choice
    if (!pythonCode) {
      const fallbackResponse = await callAI({
        messages: [
          { role: "system", content: codeGenerationPrompt + "\n\nIMPORTANT: Return ONLY the Python code inside a ```python code block. No other text." },
          { role: "user", content: `Pergunta do pesquisador: ${userQuestion}\n\nParâmetros:\n- Fonte: ${data_source}\n- Agravo/tema: ${disease_or_topic}\n- Local: ${locationStr}\n- Período: ${periodStr}\n\nGere o código Python completo para análise e visualização.` },
        ],
        _userId: userId,
        _promptType: "datasus-analysis",
        _skipProviders: [],
      } as any);

      if (!fallbackResponse.ok) {
        const errText = await fallbackResponse.text().catch(() => "unknown");
        console.error(`[datasus-query] Fallback code generation also failed (${fallbackResponse.status}): ${errText}`);
        return new Response(
          JSON.stringify({ error: "Falha ao gerar código de análise. Tente novamente em alguns instantes." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fallbackData = await fallbackResponse.json();
      const content = fallbackData.choices?.[0]?.message?.content || "";
      const codeMatch = content.match(/```python\n?([\s\S]*?)```/);
      pythonCode = codeMatch ? codeMatch[1] : content;
    }

    const sourceLabel = realData.source.includes("InfoDengue") ? "InfoDengue"
      : realData.source.includes("TabNet") ? "TabNet/SINAN"
      : realData.source.includes("OpenDataSUS") ? "OpenDataSUS"
      : realData.source.includes("Agregados") ? "IBGE Agregados"
      : realData.source.includes("SIDRA") ? "IBGE SIDRA"
      : "DataSUS";

    return new Response(
      JSON.stringify({
        type: "analysis",
        explanation: explanation + `\n\n📊 **Dados reais** obtidos via ${sourceLabel} (${realData.rowCount} registros).`,
        data_source: data_source,
        disease_or_topic: disease_or_topic,
        location: locationStr,
        period: periodStr,
        code: pythonCode,
        is_real_data: true,
        data_source_detail: realData.source,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("datasus-query error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
