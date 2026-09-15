import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Finding,
  applyInterpretation,
  buildScanCode,
  parseScanOutput,
  qualityFindings,
  rankFindings,
} from "@/lib/datamind/findings";
import { dismissFinding, loadFindings, markFilesScanned, saveFindings } from "@/lib/datamind/findingsStore";
import { CompactProfile } from "@/lib/datamind/profile";
// The scan is shipped into the sandbox from the same file the home server would
// import, inlined by Vite — the same arrangement that keeps the statistics engine
// from drifting between the two hosts.
import DATAMIND_SCAN_PY from "../../remote-exec/datamind_scan.py?raw";

/** Only the fields the scan cares about; the page owns the full file type. */
interface ScannableFile {
  id: string;
  file_name: string;
  schema_info: unknown;
  findings_scanned_at?: string | null;
}

interface Options {
  conversationId: string | undefined;
  userId: string | undefined;
  files: ScannableFile[];
  /** The sandbox is warm — this is what "deferred" means in practice. */
  ready: boolean;
  /** Runs Python in the sandbox with every file of the conversation loaded. */
  runScan: (code: string) => Promise<{ stdout: string; error: string | null }>;
  /** The model the researcher picked, so triage does not silently use another. */
  model?: { provider: string; model: string } | null;
}

function profileOf(file: ScannableFile): CompactProfile | undefined {
  return (file.schema_info as { profile?: CompactProfile } | null)?.profile;
}

/**
 * Columns the profile already flagged as identifiers or constants.
 *
 * Passed into the scan so it skips them rather than deciding for itself what a
 * useless column looks like — one judgement, made once, at upload.
 */
function excludedColumns(profile: CompactProfile | undefined): string[] {
  if (!profile) return [];
  return profile.columns.filter((c) => c.role === "id" || c.role === "constant").map((c) => c.name);
}

/**
 * The automatic findings for one conversation: read back from storage on open,
 * and computed once per file by a scan that waits for the sandbox to be warm.
 *
 * Waiting is the whole design. Running the scan at upload would make the
 * researcher pay Pyodide's multi-minute cold start before they can ask anything;
 * by the time the sandbox is ready they have usually been reading the profiler
 * for a while, and the scan costs them nothing they notice.
 */
export function useDataMindFindings({ conversationId, userId, files, ready, runScan, model }: Options) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [triageSummary, setTriageSummary] = useState<string>("");
  const [summary, setSummary] = useState<{ tested: number; significant: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Which (conversation, files) combination has already been scanned this session. */
  const scannedRef = useRef<string | null>(null);

  useEffect(() => {
    setFindings([]);
    setSummary(null);
    setError(null);
    if (!conversationId) return;

    let cancelled = false;
    loadFindings(conversationId)
      .then((stored) => {
        if (!cancelled) setFindings(stored.filter((f) => !f.dismissed));
      })
      .catch((e) => console.error("[findings] load failed:", e));

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const runFullScan = useCallback(
    async (targets: ScannableFile[]) => {
      if (!conversationId || !userId) return;

      setScanning(true);
      setError(null);
      try {
        const excludeByFile: Record<string, string[]> = {};
        for (const file of targets) {
          excludeByFile[file.file_name] = excludedColumns(profileOf(file));
        }

        const result = await runScan(buildScanCode(DATAMIND_SCAN_PY, excludeByFile));
        if (result.error) throw new Error(result.error);

        const parsed = parseScanOutput(result.stdout);
        if (!parsed) throw new Error("A varredura não devolveu resultados legíveis.");
        if (parsed.error) throw new Error(parsed.error);

        const quality = targets.flatMap((file) => qualityFindings(profileOf(file), file.file_name));
        const all = rankFindings([...quality, ...parsed.findings]);

        const fileIdByName: Record<string, string> = {};
        for (const file of targets) fileIdByName[file.file_name] = file.id;

        await saveFindings(conversationId, userId, all, fileIdByName);
        await markFilesScanned(targets.map((f) => f.id));

        // Read back rather than trusting the local copy: the upsert is what
        // assigns ids, and a finding without its id cannot be dismissed.
        const stored = await loadFindings(conversationId);
        setFindings(stored.filter((f) => !f.dismissed));
        setSummary({ tested: parsed.totalTested, significant: parsed.totalSignificant });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("[findings] scan failed:", message);
        setError(message);
        // A failed scan must not poison the session: let the next file upload
        // (or a manual rescan) try again.
        scannedRef.current = null;
      } finally {
        setScanning(false);
      }
    },
    [conversationId, userId, runScan]
  );

  useEffect(() => {
    if (!ready || !conversationId || !userId || files.length === 0) return;
    if (files.every((f) => f.findings_scanned_at)) return;

    const token = `${conversationId}:${files.map((f) => f.id).sort().join(",")}`;
    if (scannedRef.current === token) return;
    scannedRef.current = token;

    void runFullScan(files);
  }, [ready, conversationId, userId, files, runFullScan]);

  const dismiss = useCallback(async (finding: Finding) => {
    setFindings((prev) => prev.filter((f) => f.key !== finding.key));
    if (!finding.id) return;
    try {
      await dismissFinding(finding.id);
    } catch (e) {
      console.error("[findings] dismiss failed:", e);
    }
  }, []);

  /**
   * Asks the model to prioritise and explain what the scan found.
   *
   * Explicit rather than automatic: this is a paid call, and running it on every
   * upload would spend the researcher's ceiling on findings they may never open.
   * The statistics are already decided before it runs — the model only reorders
   * and puts the result into words.
   */
  const interpret = useCallback(async () => {
    if (!conversationId || !userId || findings.length === 0) return;

    setInterpreting(true);
    try {
      const { data, error: callError } = await supabase.functions.invoke("datamind-triage", {
        body: {
          findings: findings.map((f) => ({
            key: f.key,
            kind: f.kind,
            title: f.title,
            detail: f.detail,
            significant: f.significant,
            columns: f.columns,
          })),
          ...(model ? { provider: model.provider, model: model.model } : {}),
        },
      });
      if (callError) throw callError;

      const interpreted = applyInterpretation(findings, data?.items || []);
      setFindings(interpreted);
      setTriageSummary(data?.summary || "");

      const fileIdByName: Record<string, string> = {};
      for (const file of files) fileIdByName[file.file_name] = file.id;
      await saveFindings(conversationId, userId, interpreted, fileIdByName);
    } catch (e) {
      console.error("[findings] triage failed:", e);
      setError("Não foi possível interpretar os achados.");
    } finally {
      setInterpreting(false);
    }
  }, [conversationId, userId, findings, files, model]);

  /** Forces a fresh scan of every file, ignoring the scanned marker. */
  const rescan = useCallback(() => {
    scannedRef.current = null;
    void runFullScan(files);
  }, [files, runFullScan]);

  return { findings, scanning, summary, error, dismiss, rescan, interpret, interpreting, triageSummary };
}
