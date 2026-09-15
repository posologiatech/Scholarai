/**
 * Persistence for DataMind's automatic findings.
 *
 * The scan behind these findings costs a pass over the data and a few hundred
 * statistical tests inside the browser sandbox, so its shortlist is stored and
 * read back rather than recomputed — see the migration for why the payload is
 * kept whole instead of spread across columns.
 */
import { supabase } from "@/integrations/supabase/client";
import { Finding } from "./findings";

/**
 * `src/integrations/supabase/types.ts` is generated and not hand-edited, so a table
 * added by a migration that has not been regenerated yet is unknown to it. Going
 * through this narrow handle keeps that one fact in one place instead of scattering
 * casts through every query below.
 */
const db = supabase as unknown as {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => Promise<{ data: unknown; error: Error | null }>;
      in: (column: string, values: string[]) => Promise<{ data: unknown; error: Error | null }>;
    };
    upsert: (rows: unknown[], options: { onConflict: string }) => Promise<{ error: Error | null }>;
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: Error | null }>;
      in: (column: string, values: string[]) => Promise<{ error: Error | null }>;
    };
  };
};

/** Shape of one stored row; the table is newer than the generated types. */
interface FindingRow {
  id: string;
  finding_key: string;
  kind: string;
  significant: boolean;
  dismissed: boolean;
  payload: Finding;
}

export async function loadFindings(conversationId: string): Promise<Finding[]> {
  const { data, error } = await db
    .from("datamind_findings")
    .select("id, finding_key, kind, significant, dismissed, payload")
    .eq("conversation_id", conversationId);

  if (error) throw error;

  return ((data || []) as unknown as FindingRow[]).map((row) => ({
    ...row.payload,
    key: row.finding_key,
    id: row.id,
    dismissed: row.dismissed,
  }));
}

/**
 * The stored findings of several conversations at once.
 *
 * One query rather than one per conversation: the Writing Assistant lists every
 * analysis of the active project side by side, and a round trip each would make
 * opening the panel slower than the findings are worth.
 */
export async function loadFindingsByConversation(
  conversationIds: string[]
): Promise<Record<string, Finding[]>> {
  if (conversationIds.length === 0) return {};

  const { data, error } = await db
    .from("datamind_findings")
    .select("id, conversation_id, finding_key, kind, significant, dismissed, payload")
    .in("conversation_id", conversationIds);

  if (error) throw error;

  const byConversation: Record<string, Finding[]> = {};
  for (const row of (data || []) as unknown as (FindingRow & { conversation_id: string })[]) {
    if (row.dismissed) continue;
    const list = byConversation[row.conversation_id] || (byConversation[row.conversation_id] = []);
    list.push({ ...row.payload, key: row.finding_key, id: row.id, dismissed: row.dismissed });
  }
  return byConversation;
}

/**
 * Writes a scan's shortlist.
 *
 * Upserted on (conversation, key) so a re-scan of the same file refreshes the
 * numbers in place — a finding whose p-value moved after the data was cleaned
 * should change, not appear twice. `dismissed` is deliberately not in the
 * update: the researcher's decision to hide something outlives the scan that
 * produced it.
 */
export async function saveFindings(
  conversationId: string,
  userId: string,
  findings: Finding[],
  fileIdByName: Record<string, string>
): Promise<void> {
  if (findings.length === 0) return;

  const rows = findings.map((finding) => ({
    conversation_id: conversationId,
    user_id: userId,
    file_id: fileIdByName[finding.file] ?? null,
    finding_key: finding.key,
    kind: finding.kind,
    significant: finding.significant,
    payload: finding as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await db
    .from("datamind_findings")
    .upsert(rows, { onConflict: "conversation_id,finding_key" });

  if (error) throw error;
}

export async function dismissFinding(findingId: string): Promise<void> {
  const { error } = await db
    .from("datamind_findings")
    .update({ dismissed: true, updated_at: new Date().toISOString() })
    .eq("id", findingId);

  if (error) throw error;
}

/** Records that a file has been through the scan, however few findings it produced. */
export async function markFilesScanned(fileIds: string[]): Promise<void> {
  if (fileIds.length === 0) return;

  const { error } = await db
    .from("datamind_files")
    .update({ findings_scanned_at: new Date().toISOString() })
    .in("id", fileIds);

  if (error) throw error;
}
