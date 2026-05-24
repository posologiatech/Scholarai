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
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ResearchProject> & { title: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("research_projects")
        .insert({
          owner_id: user.id,
          title: input.title,
          description: input.description ?? null,
          cnpq_area: input.cnpq_area ?? null,
          keywords: input.keywords ?? [],
          objectives: input.objectives ?? null,
          status: input.status ?? "planejamento",
          start_date: input.start_date ?? null,
          end_date: input.end_date ?? null,
        })
        .select().single();
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
