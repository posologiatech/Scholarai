export type ResearchProjectStatus =
  | "planejamento" | "em_andamento" | "pausado" | "concluido" | "arquivado";

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
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_LABEL: Record<ResearchProjectStatus, { pt: string; en: string }> = {
  planejamento: { pt: "Planejamento", en: "Planning" },
  em_andamento: { pt: "Em andamento", en: "In progress" },
  pausado: { pt: "Pausado", en: "Paused" },
  concluido: { pt: "Concluído", en: "Completed" },
  arquivado: { pt: "Arquivado", en: "Archived" },
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
