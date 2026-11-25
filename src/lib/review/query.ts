import type { SourceDef } from "./databases";

export interface QueryBlock {
  id: string;
  label: string;
  /** Free-text terms (synonyms joined with OR). */
  terms: string[];
  /** Controlled vocabulary headings: MeSH / Emtree / DeCS, depending on the target source. */
  headings: string[];
}

export interface QueryFilters {
  yearMin?: number;
  yearMax?: number;
}

export interface RenderedQuery {
  text: string;
  /** Things the user must check or apply by hand in the source's own interface. */
  notes: string[];
}

type Syntax = SourceDef["syntax"];

const clean = (s: string) => s.trim().replace(/\s+/g, " ").replace(/"/g, "");
const usable = (b: QueryBlock) => ({ terms: b.terms.map(clean).filter(Boolean), headings: b.headings.map(clean).filter(Boolean) });
const quote = (t: string) => (/\s/.test(t) ? `"${t}"` : t);
const or = (xs: string[]) => xs.join(" OR ");

/**
 * Builds the search string for one source's dialect from the shared concept blocks.
 * The output is a starting point: dialects change, so every result carries notes about what to
 * verify in the real interface. Blocks with no terms are skipped.
 */
export function renderQuery(blocks: QueryBlock[], syntax: Syntax, filters: QueryFilters = {}): RenderedQuery {
  const parts = blocks.map(usable).filter((b) => b.terms.length || b.headings.length);
  const notes: string[] = [];
  if (parts.length === 0) return { text: "", notes: ["Adicione ao menos um termo."] };
  const { yearMin, yearMax } = filters;

  switch (syntax) {
    case "pubmed": {
      const groups = parts.map((b) => {
        const items = [
          // Single words stay bare so a trailing * still truncates; phrases are quoted.
          ...b.terms.map((t) => `${quote(t)}[tiab]`),
          ...b.headings.map((h) => `"${h}"[MeSH Terms]`),
        ];
        return `(${or(items)})`;
      });
      let text = groups.join(" AND ");
      if (yearMin || yearMax) text += ` AND ${yearMin ?? 1900}:${yearMax ?? new Date().getFullYear()}[dp]`;
      if (parts.some((b) => b.terms.some((t) => t.includes("*") && /\s/.test(t)))) notes.push("PubMed não aceita truncamento dentro de frases; revise os termos com * e espaço.");
      return { text, notes };
    }
    case "scopus": {
      const groups = parts.map((b) => `TITLE-ABS-KEY(${or([...b.terms, ...b.headings].map(quote))})`);
      let text = groups.join(" AND ");
      if (yearMin) text += ` AND PUBYEAR > ${yearMin - 1}`;
      if (yearMax) text += ` AND PUBYEAR < ${yearMax + 1}`;
      notes.push("Scopus não tem vocabulário controlado igual ao MeSH; os descritores foram tratados como termos livres.");
      return { text, notes };
    }
    case "wos": {
      const groups = parts.map((b) => `TS=(${or([...b.terms, ...b.headings].map(quote))})`);
      let text = groups.join(" AND ");
      if (yearMin || yearMax) text += ` AND PY=(${yearMin ?? 1900}-${yearMax ?? new Date().getFullYear()})`;
      notes.push("Web of Science não tem vocabulário controlado igual ao MeSH; os descritores foram tratados como termos livres.");
      return { text, notes };
    }
    case "ovid": {
      // Ovid searches are built line by line and combined at the end.
      const lines: string[] = [];
      const lineNos: number[] = [];
      parts.forEach((b) => {
        const sub: number[] = [];
        if (b.terms.length) { lines.push(`(${b.terms.map((t) => `${quote(t)}`).join(" or ")}).ti,ab,kf.`); sub.push(lines.length); }
        for (const h of b.headings) { lines.push(`exp ${h}/`); sub.push(lines.length); }
        if (sub.length === 1) lineNos.push(sub[0]);
        else { lines.push(sub.join(" or ")); lineNos.push(lines.length); }
      });
      lines.push(lineNos.join(" and "));
      if (yearMin || yearMax) lines.push(`limit ${lines.length} to yr="${yearMin ?? 1900}-${yearMax ?? new Date().getFullYear()}"`);
      notes.push("Use os termos do vocabulário da base (Emtree no Embase, Thesaurus no PsycINFO): confira cada 'exp .../'.");
      return { text: lines.map((l, i) => `${i + 1}. ${l}`).join("\n"), notes };
    }
    case "ebsco": {
      const groups = parts.map((b) => {
        const free = b.terms.map(quote);
        const items = [
          ...(free.length ? [`TI (${or(free)})`, `AB (${or(free)})`] : []),
          ...b.headings.map((h) => `MH "${h}+"`),
        ];
        return `(${or(items)})`;
      });
      let text = groups.join(" AND ");
      if (yearMin || yearMax) notes.push(`Aplique o limite de data ${yearMin ?? ""}–${yearMax ?? ""} na interface (Limitadores).`);
      notes.push("Confira os cabeçalhos (MH) no thesaurus da base.");
      return { text, notes };
    }
    case "bvs": {
      const groups = parts.map((b) => {
        const items = [
          ...b.terms.map((t) => `tw:${quote(t)}`),
          ...b.headings.map((h) => `mh:"${h}"`),
        ];
        return `(${or(items)})`;
      });
      if (yearMin || yearMax) notes.push(`Aplique o filtro de ano ${yearMin ?? ""}–${yearMax ?? ""} na interface do portal.`);
      notes.push("Use descritores DeCS/MeSH e confirme os campos (tw:, mh:) na ajuda da BVS.");
      return { text: groups.join(" AND "), notes };
    }
    case "cochrane": {
      const groups = parts.map((b) => `(${or([...b.terms.map((t) => `${quote(t)}:ti,ab,kw`), ...b.headings.map((h) => `[mh "${h}"]`)])})`);
      if (yearMin || yearMax) notes.push(`Aplique o intervalo de anos ${yearMin ?? ""}–${yearMax ?? ""} em Limits.`);
      return { text: groups.join(" AND "), notes };
    }
    default: {
      const groups = parts.map((b) => `(${or([...b.terms, ...b.headings].map(quote))})`);
      if (yearMin || yearMax) notes.push("O filtro de ano é aplicado pelo sistema na coleta, não na string.");
      return { text: groups.join(" AND "), notes };
    }
  }
}

export const emptyBlocks = (framework: { id: string; label: string }[]): QueryBlock[] =>
  framework.map((f) => ({ id: f.id, label: f.label, terms: [], headings: [] }));
