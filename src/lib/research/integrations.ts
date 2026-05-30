import { supabase } from "@/integrations/supabase/client";
import type { ResearchLinkType } from "./types";

/**
 * Central automation engine for cross-module integration with research projects.
 * Every link action records a row in research_project_links and (optionally) a
 * notification, feeding the project's Activity feed and notification bell.
 */

export interface LinkResourceInput {
  projectId: string;
  resourceType: ResearchLinkType;
  resourceId?: string | null;
  label?: string | null;
  url?: string | null;
  metadata?: Record<string, any>;
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Create (or upsert by resourceType+resourceId) a project link. */
export async function linkResource(input: LinkResourceInput) {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");

  // Avoid duplicates for the same resource
  if (input.resourceId) {
    const { data: existing } = await (supabase as any)
      .from("research_project_links")
      .select("id")
      .eq("project_id", input.projectId)
      .eq("resource_type", input.resourceType)
      .eq("resource_id", input.resourceId)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await (supabase as any)
        .from("research_project_links")
        .update({
          label: input.label ?? null,
          url: input.url ?? null,
          metadata: input.metadata ?? {},
        })
        .eq("id", existing.id);
      if (error) throw error;
      return existing.id as string;
    }
  }

  const { data, error } = await (supabase as any)
    .from("research_project_links")
    .insert({
      project_id: input.projectId,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      label: input.label ?? null,
      url: input.url ?? null,
      metadata: input.metadata ?? {},
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function unlinkResource(linkId: string) {
  const { error } = await (supabase as any)
    .from("research_project_links")
    .delete()
    .eq("id", linkId);
  if (error) throw error;
}

export async function fetchProjectLinks(projectId: string) {
  const { data, error } = await (supabase as any)
    .from("research_project_links")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Create an in-app notification for the current user about an automation event. */
export async function notifyProject(
  projectId: string,
  type: string,
  title: string,
  body?: string,
  link?: string,
) {
  const userId = await getUserId();
  if (!userId) return;
  await (supabase as any).from("research_notifications").insert({
    user_id: userId,
    project_id: projectId,
    type,
    title,
    body: body ?? null,
    link: link ?? null,
  });
}

/** Create a project task (used by automations like "analyze collected data"). */
export async function createProjectTask(
  projectId: string,
  title: string,
  opts?: { description?: string; status?: string; priority?: string },
) {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");
  const { error } = await (supabase as any).from("research_tasks").insert({
    project_id: projectId,
    title,
    description: opts?.description ?? null,
    status: opts?.status ?? "doing",
    priority: opts?.priority ?? "medium",
    created_by: userId,
  });
  if (error) throw error;
}

/**
 * Import a batch of papers into the project's references (deduped by DOI / external id).
 * Used by Library, Search, and Systematic Review integrations.
 */
export async function importPapersToReferences(
  projectId: string,
  papers: Array<{
    paper_db_id?: string | null;
    external_paper_id?: string | null;
    title: string;
    authors?: string | null;
    year?: number | null;
    doi?: string | null;
  }>,
) {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("research_project_references")
    .select("doi, external_paper_id")
    .eq("project_id", projectId);

  const existingDois = new Set((existing ?? []).map((r: any) => (r.doi || "").toLowerCase()).filter(Boolean));
  const existingExt = new Set((existing ?? []).map((r: any) => r.external_paper_id).filter(Boolean));

  const rows = papers
    .filter((p) => {
      if (p.doi && existingDois.has(p.doi.toLowerCase())) return false;
      if (p.external_paper_id && existingExt.has(p.external_paper_id)) return false;
      return true;
    })
    .map((p) => ({
      project_id: projectId,
      paper_db_id: p.paper_db_id ?? null,
      external_paper_id: p.external_paper_id ?? null,
      title: p.title,
      authors: p.authors ?? null,
      year: p.year ?? null,
      doi: p.doi ?? null,
      added_by: userId,
    }));

  if (rows.length === 0) return 0;
  const { error } = await supabase.from("research_project_references").insert(rows);
  if (error) throw error;
  return rows.length;
}

/** Set the research_project_id on a module's main entity. */
export async function attachEntityToProject(
  table: "datamind_conversations" | "surveys" | "writing_documents" | "systematic_reviews" | "saved_searches",
  id: string,
  projectId: string | null,
) {
  const { error } = await (supabase as any)
    .from(table)
    .update({ research_project_id: projectId })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Promote a writing document to the project's Publications list (status "escrevendo").
 * Deduped by title so re-linking does not create duplicates.
 */
export async function promoteWritingToPublication(projectId: string, title: string) {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");

  const { data: existing } = await (supabase as any)
    .from("research_publications")
    .select("id")
    .eq("project_id", projectId)
    .eq("title", title)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data, error } = await (supabase as any)
    .from("research_publications")
    .insert({
      project_id: projectId,
      title,
      status: "escrevendo",
      pub_type: "article",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
