export type ResearchProjectStatus =
  | "planejamento" | "em_andamento" | "pausado" | "concluido" | "arquivado" | "cancelado";

export type ResearchMemberRole =
  | "pi" | "co_pi" | "orientando_ic" | "orientando_mestrado"
  | "orientando_doutorado" | "posdoc" | "colaborador";

export type ResearchTaskStatus = "backlog" | "doing" | "review" | "done";
export type ResearchTaskPriority = "low" | "medium" | "high" | "urgent";
export type ResearchPublicationStatus =
  | "ideia" | "escrevendo" | "submetido" | "em_revisao" | "aceito" | "publicado" | "rejeitado";
export type ResearchAdviseeLevel =
  | "ic" | "mestrado" | "doutorado" | "posdoc" | "tcc" | "especializacao";

export type ResearchScheduleStatus =
  | "planejado" | "em_andamento" | "concluido" | "atrasado";

export type ResearchLinkType =
  | "search" | "library" | "datamind" | "writing"
  | "survey" | "systematic_review" | "meta_analysis" | "funding" | "knowledge_graph"
  | "illustration" | "coauthorship" | "datasus" | "reference_check" | "workspace";

export interface ResearchProjectLink {
  id: string;
  project_id: string;
  resource_type: ResearchLinkType;
  resource_id: string | null;
  label: string | null;
  url: string | null;
  metadata: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const LINK_TYPE_LABEL: Record<ResearchLinkType, { pt: string; en: string; route: string }> = {
  search: { pt: "Busca salva", en: "Saved search", route: "/search" },
  library: { pt: "Biblioteca", en: "Library", route: "/library" },
  datamind: { pt: "Análise DataMind", en: "DataMind analysis", route: "/datamind" },
  writing: { pt: "Escrita científica", en: "Scientific writing", route: "/writing" },
  survey: { pt: "Coleta de Dados", en: "Data Collection", route: "/surveys" },
  systematic_review: { pt: "Revisão sistemática", en: "Systematic review", route: "/systematic-review" },
  meta_analysis: { pt: "Meta-análise", en: "Meta-analysis", route: "/meta-analysis" },
  funding: { pt: "Edital de fomento", en: "Funding call", route: "/research/funding" },
  knowledge_graph: { pt: "Knowledge Graph", en: "Knowledge Graph", route: "/knowledge-graph" },
  illustration: { pt: "Ilustração", en: "Illustration", route: "/illustrations" },
  coauthorship: { pt: "Rede de coautoria", en: "Co-authorship network", route: "/coauthorship" },
  datasus: { pt: "Análise DataSUS", en: "DataSUS analysis", route: "/datasus" },
  reference_check: { pt: "Checagem de referências", en: "Reference check", route: "/reference-check" },
  workspace: { pt: "Workspace", en: "Workspace", route: "/workspaces" },
};


export type ResearchProjectCategory =
  | "ic" | "tcc" | "pos_graduacao" | "extensao" | "monitoria" | "outro";

export interface ResearchProject {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  full_content: string | null;
  cnpq_area: string | null;
  keywords: string[];
  objectives: string | null;
  status: ResearchProjectStatus;
  category: ResearchProjectCategory | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export const CATEGORY_LABEL: Record<ResearchProjectCategory, { pt: string; en: string }> = {
  ic: { pt: "Iniciação Científica", en: "Undergrad Research" },
  tcc: { pt: "TCC", en: "Capstone (TCC)" },
  pos_graduacao: { pt: "Pós-Graduação", en: "Graduate" },
  extensao: { pt: "Extensão", en: "Extension" },
  monitoria: { pt: "Monitoria", en: "Teaching Assistantship" },
  outro: { pt: "Outro", en: "Other" },
};

/** Tailwind class tokens per category (badge bg/text/border + left accent bar). */
export const CATEGORY_STYLE: Record<ResearchProjectCategory, {
  badge: string; bar: string; dot: string;
}> = {
  ic:            { badge: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300",             bar: "bg-sky-500",     dot: "bg-sky-500" },
  tcc:           { badge: "bg-violet-500/10 text-violet-700 border-violet-500/30 dark:text-violet-300", bar: "bg-violet-500",  dot: "bg-violet-500" },
  pos_graduacao: { badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  extensao:      { badge: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",     bar: "bg-amber-500",   dot: "bg-amber-500" },
  monitoria:     { badge: "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300",         bar: "bg-rose-500",    dot: "bg-rose-500" },
  outro:         { badge: "bg-slate-500/10 text-slate-700 border-slate-500/30 dark:text-slate-300",     bar: "bg-slate-400",   dot: "bg-slate-400" },
};


export const STATUS_LABEL: Record<ResearchProjectStatus, { pt: string; en: string }> = {
  planejamento: { pt: "Planejamento", en: "Planning" },
  em_andamento: { pt: "Em andamento", en: "In progress" },
  pausado: { pt: "Pausado", en: "Paused" },
  concluido: { pt: "Concluído", en: "Completed" },
  arquivado: { pt: "Arquivado", en: "Archived" },
  cancelado: { pt: "Cancelado", en: "Cancelled" },
};

export const ROLE_LABEL: Record<ResearchMemberRole, { pt: string; en: string }> = {
  pi: { pt: "PI (Coordenador)", en: "PI (Lead)" },
  co_pi: { pt: "Co-PI", en: "Co-PI" },
  orientando_ic: { pt: "Orientando — IC", en: "Advisee — UG Research" },
  orientando_mestrado: { pt: "Orientando — Mestrado", en: "Advisee — Master's" },
  orientando_doutorado: { pt: "Orientando — Doutorado", en: "Advisee — PhD" },
  posdoc: { pt: "Pós-doutorando", en: "Postdoc" },
  colaborador: { pt: "Colaborador", en: "Collaborator" },
};

export const TASK_STATUS_LABEL: Record<ResearchTaskStatus, { pt: string; en: string }> = {
  backlog: { pt: "A fazer", en: "Backlog" },
  doing: { pt: "Fazendo", en: "Doing" },
  review: { pt: "Revisão", en: "Review" },
  done: { pt: "Concluído", en: "Done" },
};

export const PUB_STATUS_LABEL: Record<ResearchPublicationStatus, { pt: string; en: string }> = {
  ideia: { pt: "Ideia", en: "Idea" },
  escrevendo: { pt: "Escrevendo", en: "Writing" },
  submetido: { pt: "Submetido", en: "Submitted" },
  em_revisao: { pt: "Em revisão", en: "In review" },
  aceito: { pt: "Aceito", en: "Accepted" },
  publicado: { pt: "Publicado", en: "Published" },
  rejeitado: { pt: "Rejeitado", en: "Rejected" },
};

export const SCHEDULE_STATUS_LABEL: Record<ResearchScheduleStatus, { pt: string; en: string }> = {
  planejado: { pt: "Planejado", en: "Planned" },
  em_andamento: { pt: "Em andamento", en: "In progress" },
  concluido: { pt: "Concluído", en: "Completed" },
  atrasado: { pt: "Atrasado", en: "Delayed" },
};

export const PROJECT_BODY_TEMPLATE_PT = `# Introdução

Contexto, problema de pesquisa e justificativa.

# Objetivos

## Objetivo Geral


## Objetivos Específicos

-
-

# Metodologia

Desenho do estudo, população, instrumentos e análise.

# Fases do Projeto

1. Fase 1 —
2. Fase 2 —
3. Fase 3 —

# Resultados Esperados


# Cronograma resumido


# Referências
`;
