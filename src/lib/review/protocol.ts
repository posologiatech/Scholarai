import { frameworkName, type ReviewTypeDef } from "./types";

export interface EligibilityItem { kind: "include" | "exclude"; text: string }

export interface ReviewRecord {
  id: string;
  owner_id: string;
  review_type: string;
  title: string;
  question: string;
  area: string;
  locale: "pt" | "en";
  definition_version: string;
  framework: Record<string, string>;
  eligibility: EligibilityItem[];
  registry: { id?: string };
  protocol_document: string | null;
  protocol_locked_at: string | null;
  protocol_locked_by: string | null;
  current_stage: string;
  stage_state: Record<string, unknown>;
  research_project_id: string | null;
  is_living: boolean;
  legacy_systematic_review_id: string | null;
  ai_disclosure: { feature: string; model?: string; first_used_at?: string; role?: string }[];
  created_at: string;
  updated_at: string;
}

/** Immutable markdown snapshot of the protocol, stored when the user locks it. */
export function buildProtocolDocument(def: ReviewTypeDef, r: ReviewRecord, lockedAt: string): string {
  const pt = r.locale === "pt";
  const L = (x: { pt: string; en: string }) => (pt ? x.pt : x.en);
  const out: string[] = [];
  out.push(`# ${pt ? "Protocolo" : "Protocol"}: ${L(def.label)}`);
  out.push("");
  out.push(`${pt ? "Título de trabalho" : "Working title"}: ${r.title || "—"}`);
  out.push(`${pt ? "Congelado em" : "Locked on"}: ${new Date(lockedAt).toISOString()}`);
  out.push(`${pt ? "Versão da definição do processo" : "Process definition version"}: ${def.version}`);
  if (r.registry?.id) out.push(`${pt ? "Registro" : "Registration"} (${def.registry?.name ?? ""}): ${r.registry.id}`);
  out.push("");
  out.push(`## ${pt ? "Pergunta" : "Question"}`);
  out.push(r.question || "—");
  out.push("");
  out.push(`## ${frameworkName(def, r.locale)}`);
  for (const f of def.framework.fields) out.push(`- **${L(f.label)}:** ${r.framework?.[f.key] || "—"}`);
  out.push("");
  out.push(`## ${pt ? "Critérios de elegibilidade" : "Eligibility criteria"}`);
  for (const kind of ["include", "exclude"] as const) {
    const items = (r.eligibility ?? []).filter((e) => e.kind === kind);
    out.push(`### ${kind === "include" ? (pt ? "Inclusão" : "Inclusion") : (pt ? "Exclusão" : "Exclusion")}`);
    out.push(...(items.length ? items.map((e) => `- ${e.text}`) : ["- —"]));
  }
  out.push("");
  out.push(`## ${pt ? "Guia de relato" : "Reporting guideline"}`);
  out.push(def.reportingGuideline.name);
  return out.join("\n");
}
