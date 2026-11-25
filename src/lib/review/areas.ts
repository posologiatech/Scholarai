import type { ReviewArea } from "./databases";

export const AREA_LABELS: Record<ReviewArea, { pt: string; en: string }> = {
  health: { pt: "Saúde (clínica)", en: "Health (clinical)" },
  nursing: { pt: "Enfermagem", en: "Nursing" },
  pharmacy: { pt: "Farmácia", en: "Pharmacy" },
  psychology: { pt: "Psicologia", en: "Psychology" },
  education: { pt: "Educação", en: "Education" },
  social: { pt: "Ciências sociais", en: "Social sciences" },
  engineering: { pt: "Engenharia e tecnologia", en: "Engineering and technology" },
  general: { pt: "Outra / multidisciplinar", en: "Other / multidisciplinary" },
};
