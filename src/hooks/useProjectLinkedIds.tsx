import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { ResearchLinkType } from "@/lib/research/types";

/**
 * Resource ids of `resourceType` already linked to the active project —
 * feeds the `linked` prop on LinkToProjectButton so it can show "Linked to X" ✓.
 * Invalidated by LinkToProjectButton itself whenever a new link is created.
 */
export const useProjectLinkedIds = (resourceType: ResearchLinkType) => {
  const { activeProjectId } = useActiveProject();
  const { data } = useQuery({
    queryKey: ["project-links", activeProjectId, resourceType],
    enabled: !!activeProjectId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("research_project_links")
        .select("resource_id")
        .eq("project_id", activeProjectId)
        .eq("resource_type", resourceType);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.resource_id as string));
    },
  });
  return data ?? new Set<string>();
};
