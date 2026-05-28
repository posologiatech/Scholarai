// Pre-built schedule templates for research projects (months offset from start)
export type TemplateItem = {
  title: string;
  phase: string;
  monthStart: number;
  monthEnd: number;
  is_milestone?: boolean;
  predecessorRef?: number; // index of predecessor in same template
};

export type ScheduleTemplate = {
  id: string;
  label_pt: string;
  label_en: string;
  description_pt: string;
  description_en: string;
  totalMonths: number;
  items: TemplateItem[];
};

export const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    id: "ic",
    label_pt: "Iniciação Científica (12 meses)",
    label_en: "Undergraduate Research (12 months)",
    description_pt: "PIBIC/PIBITI padrão CNPq",
    description_en: "CNPq PIBIC/PIBITI standard",
    totalMonths: 12,
    items: [
      { title: "Revisão bibliográfica", phase: "Fundamentação", monthStart: 0, monthEnd: 3 },
      { title: "Definição do método", phase: "Planejamento", monthStart: 2, monthEnd: 4, predecessorRef: 0 },
      { title: "Coleta de dados", phase: "Execução", monthStart: 4, monthEnd: 8, predecessorRef: 1 },
      { title: "Análise dos resultados", phase: "Análise", monthStart: 8, monthEnd: 10, predecessorRef: 2 },
      { title: "Redação do relatório final", phase: "Conclusão", monthStart: 10, monthEnd: 12, predecessorRef: 3 },
      { title: "Apresentação no SIC/Jornada", phase: "Conclusão", monthStart: 11, monthEnd: 12, is_milestone: true, predecessorRef: 4 },
    ],
  },
  {
    id: "mestrado",
    label_pt: "Mestrado (24 meses)",
    label_en: "Master's (24 months)",
    description_pt: "CAPES/CNPq — defesa em 24 meses",
    description_en: "CAPES/CNPq — defense at 24 months",
    totalMonths: 24,
    items: [
      { title: "Cumprimento de créditos", phase: "Disciplinas", monthStart: 0, monthEnd: 12 },
      { title: "Revisão sistemática da literatura", phase: "Fundamentação", monthStart: 0, monthEnd: 6 },
      { title: "Qualificação", phase: "Qualificação", monthStart: 11, monthEnd: 12, is_milestone: true, predecessorRef: 1 },
      { title: "Submissão ao CEP", phase: "Ética", monthStart: 6, monthEnd: 9 },
      { title: "Coleta de dados", phase: "Execução", monthStart: 12, monthEnd: 18, predecessorRef: 3 },
      { title: "Análise estatística", phase: "Análise", monthStart: 18, monthEnd: 21, predecessorRef: 4 },
      { title: "Redação da dissertação", phase: "Escrita", monthStart: 18, monthEnd: 23, predecessorRef: 4 },
      { title: "Defesa", phase: "Defesa", monthStart: 23, monthEnd: 24, is_milestone: true, predecessorRef: 6 },
    ],
  },
  {
    id: "doutorado",
    label_pt: "Doutorado (48 meses)",
    label_en: "Doctorate (48 months)",
    description_pt: "Padrão CAPES, qualificação no 24º mês",
    description_en: "CAPES standard, qualification at month 24",
    totalMonths: 48,
    items: [
      { title: "Disciplinas e seminários", phase: "Disciplinas", monthStart: 0, monthEnd: 18 },
      { title: "Revisão sistemática", phase: "Fundamentação", monthStart: 0, monthEnd: 9 },
      { title: "Submissão ao CEP/CONEP", phase: "Ética", monthStart: 9, monthEnd: 14 },
      { title: "Qualificação", phase: "Qualificação", monthStart: 23, monthEnd: 24, is_milestone: true, predecessorRef: 1 },
      { title: "Coleta de dados", phase: "Execução", monthStart: 14, monthEnd: 30, predecessorRef: 2 },
      { title: "Análise dos dados", phase: "Análise", monthStart: 30, monthEnd: 36, predecessorRef: 4 },
      { title: "Estágio sanduíche (opcional)", phase: "Internacionalização", monthStart: 24, monthEnd: 30 },
      { title: "Publicação de artigos", phase: "Publicação", monthStart: 30, monthEnd: 46 },
      { title: "Redação da tese", phase: "Escrita", monthStart: 36, monthEnd: 46, predecessorRef: 5 },
      { title: "Defesa", phase: "Defesa", monthStart: 47, monthEnd: 48, is_milestone: true, predecessorRef: 8 },
    ],
  },
  {
    id: "cnpq_universal",
    label_pt: "CNPq Universal (36 meses)",
    label_en: "CNPq Universal (36 months)",
    description_pt: "Edital Universal — pesquisa básica/aplicada",
    description_en: "CNPq Universal call",
    totalMonths: 36,
    items: [
      { title: "Setup e contratações", phase: "Setup", monthStart: 0, monthEnd: 3 },
      { title: "Submissão ética", phase: "Ética", monthStart: 1, monthEnd: 5 },
      { title: "Execução experimental — Fase 1", phase: "Execução", monthStart: 5, monthEnd: 18, predecessorRef: 1 },
      { title: "Relatório parcial CNPq", phase: "Reporte", monthStart: 17, monthEnd: 18, is_milestone: true, predecessorRef: 2 },
      { title: "Execução experimental — Fase 2", phase: "Execução", monthStart: 18, monthEnd: 30, predecessorRef: 3 },
      { title: "Análise integrada", phase: "Análise", monthStart: 28, monthEnd: 33, predecessorRef: 4 },
      { title: "Publicação de resultados", phase: "Publicação", monthStart: 30, monthEnd: 36 },
      { title: "Prestação de contas final", phase: "Reporte", monthStart: 35, monthEnd: 36, is_milestone: true },
    ],
  },
  {
    id: "fapesp",
    label_pt: "FAPESP Auxílio Regular (24 meses)",
    label_en: "FAPESP Regular Grant (24 months)",
    description_pt: "Auxílio Regular à Pesquisa",
    description_en: "Regular Research Aid",
    totalMonths: 24,
    items: [
      { title: "Aquisição de materiais e equipamentos", phase: "Setup", monthStart: 0, monthEnd: 4 },
      { title: "Treinamento da equipe", phase: "Setup", monthStart: 2, monthEnd: 5 },
      { title: "Execução experimental", phase: "Execução", monthStart: 4, monthEnd: 18, predecessorRef: 1 },
      { title: "Relatório científico parcial FAPESP", phase: "Reporte", monthStart: 11, monthEnd: 12, is_milestone: true },
      { title: "Análise de dados", phase: "Análise", monthStart: 16, monthEnd: 22, predecessorRef: 2 },
      { title: "Publicação", phase: "Publicação", monthStart: 18, monthEnd: 24 },
      { title: "Relatório final FAPESP", phase: "Reporte", monthStart: 23, monthEnd: 24, is_milestone: true },
    ],
  },
  {
    id: "ensaio_clinico",
    label_pt: "Ensaio Clínico (36 meses)",
    label_en: "Clinical Trial (36 months)",
    description_pt: "ICH-GCP / Plataforma Brasil / ReBEC",
    description_en: "ICH-GCP / Plataforma Brasil / ReBEC",
    totalMonths: 36,
    items: [
      { title: "Protocolo e brochura do investigador", phase: "Setup", monthStart: 0, monthEnd: 3 },
      { title: "Submissão CEP/CONEP", phase: "Regulatório", monthStart: 2, monthEnd: 8, predecessorRef: 0 },
      { title: "Registro ReBEC/ClinicalTrials.gov", phase: "Regulatório", monthStart: 6, monthEnd: 8, is_milestone: true, predecessorRef: 1 },
      { title: "Treinamento dos centros", phase: "Setup", monthStart: 7, monthEnd: 9, predecessorRef: 1 },
      { title: "First Patient In (FPI)", phase: "Recrutamento", monthStart: 9, monthEnd: 10, is_milestone: true, predecessorRef: 3 },
      { title: "Recrutamento e follow-up", phase: "Execução", monthStart: 9, monthEnd: 27, predecessorRef: 4 },
      { title: "Last Patient Last Visit (LPLV)", phase: "Execução", monthStart: 27, monthEnd: 28, is_milestone: true, predecessorRef: 5 },
      { title: "Database lock", phase: "Análise", monthStart: 28, monthEnd: 30, predecessorRef: 6 },
      { title: "Análise estatística e CSR", phase: "Análise", monthStart: 30, monthEnd: 34, predecessorRef: 7 },
      { title: "Publicação CONSORT", phase: "Publicação", monthStart: 33, monthEnd: 36, predecessorRef: 8 },
    ],
  },
];
