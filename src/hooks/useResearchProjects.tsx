import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ResearchProject } from "@/lib/research/types";

export const useResearchProjects = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["research-projects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ResearchProject[];
    },
  });
};

export const useResearchProject = (id?: string) => {
  return useQuery({
    queryKey: ["research-project", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("research_projects").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as ResearchProject;
    },
  });
};

export const useCreateResearchProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ResearchProject> & { title: string }) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any).rpc("create_research_project", {
        _title: input.title,
        _description: input.description ?? null,
        _cnpq_area: input.cnpq_area ?? null,
        _keywords: input.keywords ?? [],
        _objectives: input.objectives ?? null,
        _status: input.status ?? "planejamento",
        _start_date: input.start_date ?? null,
        _end_date: input.end_date ?? null,
        _category: (input as any).category ?? "outro",
      });
      if (error) throw error;
      return data as ResearchProject;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["research-projects"] }),
  });
};

export const useUpdateResearchProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ResearchProject> }) => {
      const { data, error } = await supabase
        .from("research_projects").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["research-projects"] });
      qc.invalidateQueries({ queryKey: ["research-project", vars.id] });
    },
  });
};

export const useDeleteResearchProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("research_projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["research-projects"] }),
  });
};
