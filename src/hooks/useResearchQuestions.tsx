import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ResearchProject, ResearchProjectCategory } from "@/lib/research/types";
import { PROJECT_BODY_TEMPLATE_PT } from "@/lib/research/types";

export interface ResearchQuestion {
  id: string;
  owner_id: string;
  question: string;
  description: string | null;
  category: ResearchProjectCategory | null;
  cnpq_area: string | null;
  keywords: string[];
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ResearchQuestionInput = {
  question: string;
  description?: string | null;
  category?: ResearchProjectCategory;
  cnpq_area?: string | null;
  keywords?: string[];
};

// The table is newer than the generated Supabase types, hence the loose client.
const table = () => (supabase as any).from("research_questions");

export const useResearchQuestions = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["research-questions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await table().select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ResearchQuestion[];
    },
  });
};

export const useSaveResearchQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ResearchQuestionInput & { id?: string }) => {
      const row = {
        question: input.question.trim(),
        description: input.description?.trim() || null,
        category: input.category ?? "outro",
        cnpq_area: input.cnpq_area?.trim() || null,
        keywords: input.keywords ?? [],
      };
      const { error } = id
        ? await table().update(row).eq("id", id)
        : await table().insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["research-questions"] }),
  });
};

export const useDeleteResearchQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await table().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["research-questions"] }),
  });
};

/** Seeds the usual project body with the question in the places that frame the whole study. */
const buildBody = (q: ResearchQuestion) => {
  const context = q.description?.trim();
  return PROJECT_BODY_TEMPLATE_PT
    .replace(
      "Contexto, problema de pesquisa e justificativa.",
      `**Pergunta de pesquisa:** ${q.question.trim()}\n\n${context ? `${context}\n\n` : ""}Contexto, problema de pesquisa e justificativa.`,
    )
    .replace("## Objetivo Geral\n\n", `## Objetivo Geral\n\nResponder à pergunta: ${q.question.trim()}\n`);
};

/**
 * Turns a question into a project built the same way as any other project (through the
 * create_research_project RPC, so ownership/membership is set up identically), then
 * links the question to it.
 */
export const usePromoteResearchQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ question: q, withAI }: { question: ResearchQuestion; withAI: boolean }) => {
      if (q.project_id) throw new Error("Already a project");
      const { data, error } = await (supabase as any).rpc("create_research_project", {
        _title: q.question.trim(),
        _description: q.description?.trim() || null,
        _cnpq_area: q.cnpq_area ?? null,
        _keywords: q.keywords ?? [],
        _objectives: `Responder à pergunta de pesquisa: ${q.question.trim()}`,
        _status: "planejamento",
        _start_date: null,
        _end_date: null,
        _category: q.category ?? "outro",
      });
      if (error) throw error;
      const project = data as ResearchProject;

      const { error: bodyErr } = await supabase
        .from("research_projects").update({ full_content: buildBody(q) }).eq("id", project.id);
      if (bodyErr) throw bodyErr;

      const { error: linkErr } = await table().update({ project_id: project.id }).eq("id", q.id);
      if (linkErr) throw linkErr;

      // The AI draft is a bonus on top of a project that already exists and is already linked:
      // if it fails (quota, timeout), the researcher keeps the project with the template body
      // instead of losing the whole promotion.
      let aiError: string | null = null;
      if (withAI) {
        try {
          const { data: draft, error: fnErr } = await supabase.functions.invoke("research-autowrite", {
            body: {
              project_id: project.id,
              section: "completo",
              extra_instructions:
                `A pergunta de pesquisa é: "${q.question.trim()}". Desenhe o projeto inteiro para respondê-la: ` +
                `a Introdução deve terminar nela, o Objetivo Geral deve respondê-la e a Metodologia deve propor o desenho de estudo mais adequado.`,
            },
          });
          if (fnErr) throw fnErr;
          if (draft?.error) throw new Error(draft.error);
          if (!draft?.text) throw new Error("Empty draft");
          const { error: saveErr } = await supabase
            .from("research_projects").update({ full_content: draft.text }).eq("id", project.id);
          if (saveErr) throw saveErr;
        } catch (e: any) {
          aiError = e?.message ?? "AI draft failed";
        }
      }
      return { project, aiError };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["research-questions"] });
      qc.invalidateQueries({ queryKey: ["research-projects"] });
    },
  });
};
