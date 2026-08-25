export type SectionId = "abstract" | "introduction" | "methods" | "results" | "discussion" | "conclusion";

export interface SectionDef {
  id: SectionId;
  label: { pt: string; en: string };
}

// Canonical paper order — abstract first, matching how a manuscript actually reads top-to-bottom.
export const SECTIONS: SectionDef[] = [
  { id: "abstract", label: { pt: "Resumo", en: "Abstract" } },
  { id: "introduction", label: { pt: "Introdução", en: "Introduction" } },
  { id: "methods", label: { pt: "Métodos", en: "Methods" } },
  { id: "results", label: { pt: "Resultados", en: "Results" } },
  { id: "discussion", label: { pt: "Discussão", en: "Discussion" } },
  { id: "conclusion", label: { pt: "Conclusão", en: "Conclusion" } },
];
