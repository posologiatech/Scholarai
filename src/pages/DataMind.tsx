import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { linkResource } from "@/lib/research/integrations";
import { useSubscription } from "@/hooks/useSubscription";
import { UsageLimitDialog } from "@/components/app/UpgradeGate";
import { supabase } from "@/integrations/supabase/client";
import { usePyodide, PyodideStatus } from "@/hooks/usePyodide";
import { useDataMindFindings } from "@/hooks/useDataMindFindings";
import DataMindSidebar from "@/components/datamind/DataMindSidebar";
import DataMindChat from "@/components/datamind/DataMindChat";
import DataMindModelSelector from "@/components/datamind/DataMindModelSelector";
import DataMindSandboxPanel from "@/components/datamind/DataMindSandboxPanel";
import SavePipelineDialog from "@/components/datamind/SavePipelineDialog";
import ApplyPipelineDialog from "@/components/datamind/ApplyPipelineDialog";
import DataMindDbConnections from "@/components/datamind/DataMindDbConnections";
import DataMindDbQuery from "@/components/datamind/DataMindDbQuery";
import DataMindAutoReport from "@/components/datamind/DataMindAutoReport";
import DataMindCollaboration from "@/components/datamind/DataMindCollaboration";
import DataCleaningPanel from "@/components/datamind/DataCleaningPanel";
import DataMindProfiler from "@/components/datamind/DataMindProfiler";
import DataMindVersioning from "@/components/datamind/DataMindVersioning";
import { useWebR } from "@/hooks/useWebR";
import DataMindStatsMenu from "@/components/datamind/DataMindStatsMenu";
import HeatmapOverlayDialog from "@/components/datamind/HeatmapOverlayDialog";
import GoogleSheetsImportDialog from "@/components/datamind/GoogleSheetsImportDialog";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeft, GitBranch, Sparkles, Activity, Trash2, Share2, Flame, Server } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DEFAULT_DIALECT,
  ParsedTable,
  SandboxFile,
  TabularDialect,
  parseCSVBuffer,
  toCSV,
} from "@/lib/datamind/parseTabular";
import { parseExcelBuffer } from "@/lib/datamind/parseWorkbook";
import { CompactProfile, compactProfile, profileDataset } from "@/lib/datamind/profile";
import { HistoryEntry, buildHistory } from "@/lib/datamind/conversationContext";
import { AssistantReply, extractExplanationPrefix, parseAssistantReply } from "@/lib/datamind/parseAssistantReply";
import {
  AnalysisStep,
  buildStepMessage,
  buildSynthesisMessage,
  formatPlanAnnouncement,
  formatStepHeading,
  formatStepStage,
  normalizePlan,
} from "@/lib/datamind/analysisPlan";
import { readAssistantStream } from "@/lib/datamind/streamAssistant";
import { LinkToProjectButton } from "@/components/research/LinkToProjectButton";
import { RegisterOutputButton } from "@/components/research/RegisterOutputButton";
import { useProjectLinkedIds } from "@/hooks/useProjectLinkedIds";

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface DataMindFile {
  id: string;
  conversation_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  schema_info: Record<string, unknown>;
  preview_data: unknown[];
  created_at: string;
  /** Set once the automatic finding scan has been through this file. */
  findings_scanned_at?: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  code_block: string | null;
  output_type: string | null;
  output_content: string | null;
  created_at: string;
}

export interface SpreadsheetData {
  columns: string[];
  rows: Record<string, string>[];
  /** How the file was read, so the sandbox can read it identically. */
  dialect?: TabularDialect;
  /** True row count in the file, which can exceed the rows held in memory. */
  totalRows?: number;
  truncated?: boolean;
}

export interface SelectedContext {
  data: Record<string, string>[];
  summary: string;
}

const MAX_ROWS = 50000;
// Above this combined row count, execution routes to the owner's home-server sandbox
// instead of the in-browser Pyodide (see supabase/functions/datamind-run-remote).
const REMOTE_EXEC_THRESHOLD_ROWS = 50000;

/** Newline constant, so output assembly reads the same everywhere it appears. */
const NL = String.fromCharCode(10);

const DATAMIND_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/datamind-chat`;

// How many times a failed analysis is sent back to the model for repair before the
// researcher is shown an error. Each attempt is one extra AI call.
const MAX_FIX_ATTEMPTS = 2;

/** What the model is told about each loaded file: columns plus the compact profile. */
interface FileSchemaPayload {
  file_name: string;
  columns: string[];
  rows?: number;
  profile?: CompactProfile;
}

/** One cell of a multi-step plan, as sent to the edge function. */
interface PlanStepRef {
  index: number;
  total: number;
  /** The closing synthesis turn, which reads results instead of producing code. */
  final?: boolean;
}

/** The shape every sandbox engine returns (Pyodide, WebR and the remote server). */
interface ExecutionResult {
  stdout: string;
  images: string[];
  error: string | null;
}

/**
 * Reads back the dialect stored on the file row. Files uploaded before dialect
 * detection existed have none, so they keep the engines' defaults — which is
 * exactly how they were read at the time.
 */
function readDialect(schemaInfo: Record<string, unknown> | null | undefined): TabularDialect | undefined {
  const dialect = (schemaInfo as { dialect?: TabularDialect } | null)?.dialect;
  if (!dialect || !dialect.delimiter) return undefined;
  return dialect;
}

/** Pairs every file with the dialect it was read under, for any sandbox engine. */
function toSandboxFiles(files: DataMindFile[]): SandboxFile[] {
  return files.map((f) => ({ fileName: f.file_name, dialect: readDialect(f.schema_info) }));
}

const DataMind = () => {
  const { id: conversationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProjectId } = useActiveProject();
  const linkedDataMindIds = useProjectLinkedIds("datamind");
  // Personal feature: only this account can route large-dataset execution to the
  // owner's home server. Real enforcement lives server-side in the edge function —
  // this is just for deciding what to show/attempt in the UI.
  const isOwner = !!user && user.id === import.meta.env.VITE_DATAMIND_REMOTE_EXEC_OWNER_ID;
  const { canUse } = useSubscription();
  const [showDmLimitDialog, setShowDmLimitDialog] = useState(false);
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<DataMindFile[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  // What the assistant is currently doing, shown instead of a generic spinner.
  const [loadingStage, setLoadingStage] = useState<string | null>(null);
  // The explanation as it streams in, before the message row exists.
  const [streamingText, setStreamingText] = useState("");
  const [selectedModel, setSelectedModel] = useState<{ provider: string; model: string } | null>(null);
  const [codeLanguage, setCodeLanguage] = useState("python");
  const pyodide = usePyodide();
  const webR = useWebR();
  const loadedFilesRef = useRef<Set<string>>(new Set());
  // The scan callback is handed to a hook, and rebuilding it on every file change
  // would retrigger that hook's effect; the ref keeps it stable.
  const filesForScanRef = useRef<DataMindFile[]>([]);
  const [applyPipelineOpen, setApplyPipelineOpen] = useState(false);
  const [activeDbConnection, setActiveDbConnection] = useState<any>(null);
  const [cleaningOpen, setCleaningOpen] = useState(false);
  const [showProfiler, setShowProfiler] = useState(false);
  const [profilingDone, setProfilingDone] = useState(false);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [googleSheetsOpen, setGoogleSheetsOpen] = useState(false);
  const [usedRemoteExec, setUsedRemoteExec] = useState(false);
  // A multi-step plan runs several AI calls back to back, so it needs a way out that
  // does not mean reloading the page.
  const [planRunning, setPlanRunning] = useState(false);
  const planAbortRef = useRef(false);

  // Full spreadsheet data (client-side only, not persisted)
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData | null>(null);
  const [selectedContext, setSelectedContext] = useState<SelectedContext | null>(null);

  // Bulk selection state
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const toggleSelectConv = (id: string) => {
    setSelectedConvIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
    setSelectedConvIds(new Set());
  };

  const bulkDelete = async () => {
    for (const id of selectedConvIds) {
      await deleteConversation(id);
    }
    setSelectedConvIds(new Set());
    setSelectionMode(false);
    toast({ title: `${selectedConvIds.size} conversa(s) apagada(s)` });
  };

  const bulkShare = async () => {
    const selected = conversations.filter((c) => selectedConvIds.has(c.id));
    const lines = selected.map((c) => `• ${c.title}`).join("\n");
    const text = `Conversas DataMind compartilhadas:\n${lines}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Links copiados!", description: `${selectedConvIds.size} conversa(s) copiadas para a área de transferência.` });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  useEffect(() => {
    filesForScanRef.current = files;
  }, [files]);

  // Auto-start sandbox on mount
  useEffect(() => {
    if (pyodide.status === "idle") {
      pyodide.init();
    }
  }, []);

  // Load conversations
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("datamind_conversations")
        .select("*")
        .order("updated_at", { ascending: false });
      if (data) setConversations(data);
    };
    load();
  }, [user]);

  // Load messages when conversation changes — reset spreadsheet data
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setFiles([]);
      setSpreadsheetData(null);
      setSelectedContext(null);
      setShowProfiler(false);
      setProfilingDone(false);
      return;
    }
    const loadMessages = async () => {
      const [msgRes, fileRes] = await Promise.all([
        supabase
          .from("datamind_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true }),
        supabase
          .from("datamind_files")
          .select("*")
          .eq("conversation_id", conversationId),
      ]);
      if (msgRes.data) setMessages(msgRes.data);
      if (fileRes.data) {
        const loadedFiles = fileRes.data as unknown as DataMindFile[];
        setFiles(loadedFiles);
        // Re-parse the first file for spreadsheet if available
        if (loadedFiles.length > 0) {
          reParseFileFromStorage(loadedFiles[0]);
        }
      }
    };
    loadMessages();
  }, [conversationId]);

  // Re-download and parse file from storage for interactive grid
  const reParseFileFromStorage = async (file: DataMindFile) => {
    try {
      const { data: blob } = await supabase.storage
        .from("datamind-files")
        .download(file.file_path);
      if (!blob) return;

      const buffer = await blob.arrayBuffer();
      if (file.file_name.match(/\.xlsx?$/i)) {
        parseExcelFull(buffer);
      } else {
        parseCSVFull(buffer, readDialect(file.schema_info));
      }
    } catch (e) {
      console.error("Failed to re-parse file for spreadsheet:", e);
    }
  };

  /**
   * Parsing goes through the shared ingestion layer so the grid, the profiler and
   * the sandbox all see the same columns and the same numbers. `dialect` lets a
   * reload reuse what was detected on upload instead of guessing again.
   */
  const parseCSVFull = (buffer: ArrayBuffer, dialect?: TabularDialect): ParsedTable => {
    const table = parseCSVBuffer(buffer, { maxRows: MAX_ROWS, dialect });
    setSpreadsheetData(table);
    return table;
  };

  const parseExcelFull = (buffer: ArrayBuffer): ParsedTable | null => {
    try {
      const table = parseExcelBuffer(buffer, { maxRows: MAX_ROWS });
      setSpreadsheetData(table);
      return table;
    } catch (e) {
      console.error("Excel parse error:", e);
      return null;
    }
  };

  const createConversation = async (title?: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("datamind_conversations")
      .insert({ user_id: user.id, title: title || "Nova análise", research_project_id: activeProjectId })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro ao criar conversa", variant: "destructive" });
      return null;
    }
    if (activeProjectId) {
      await linkResource({
        projectId: activeProjectId,
        resourceType: "datamind",
        resourceId: data.id,
        label: data.title,
      });
    }
    setConversations((prev) => [data, ...prev]);
    navigate(`/datamind/${data.id}`);
    return data.id as string;
  };

  const deleteConversation = async (id: string) => {
    await supabase.from("datamind_messages").delete().eq("conversation_id", id);
    await supabase.from("datamind_files").delete().eq("conversation_id", id);
    await supabase.from("datamind_conversations").delete().eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (conversationId === id) navigate("/datamind");
  };

  // Builds a CSV blob from parsed rows so the import has the same durable storage
  // snapshot (and reload/reparse path) as a regular CSV upload — not a live sync.
  const buildCSVBlob = (columns: string[], rows: Record<string, string>[]): Blob =>
    new Blob([toCSV(columns, rows)], { type: "text/csv;charset=utf-8" });

  const importGoogleSheet = async (spreadsheetUrl: string, sheetName: string) => {
    if (!user) return;

    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;

    if (!providerToken) {
      toast({
        title: "Permissão do Google Sheets necessária",
        description: "Você será redirecionado para autorizar o acesso. Após autorizar, tente importar novamente.",
      });
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.href,
          scopes: "https://www.googleapis.com/auth/spreadsheets.readonly",
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      return;
    }

    const { data, error } = await supabase.functions.invoke("import-google-sheet", {
      body: { spreadsheet_url: spreadsheetUrl, sheet_name: sheetName || undefined, provider_token: providerToken },
    });

    if (error || data?.error) {
      const errMsg = data?.error || error?.message || "Falha ao importar a planilha.";
      if (errMsg.includes("insufficient") || errMsg.includes("scope") || errMsg.includes("PERMISSION_DENIED")) {
        toast({ title: "Permissão insuficiente", description: "Redirecionando para autorizar acesso ao Google Sheets..." });
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.href,
            scopes: "https://www.googleapis.com/auth/spreadsheets.readonly",
            queryParams: { access_type: "offline", prompt: "consent" },
          },
        });
        return;
      }
      toast({ title: "Erro ao importar", description: errMsg, variant: "destructive" });
      return;
    }

    const { title, sheet_name, columns, rows } = data as { title: string; sheet_name: string; columns: string[]; rows: Record<string, string>[] };

    let activeConvId = conversationId;
    if (!activeConvId) {
      activeConvId = await createConversation(title);
      if (!activeConvId) return;
    }

    const safeName = `${title} - ${sheet_name}`.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "planilha";
    const filePath = `${user.id}/${Date.now()}_${safeName}.csv`;
    const blob = buildCSVBlob(columns, rows);

    const { error: uploadError } = await supabase.storage.from("datamind-files").upload(filePath, blob);
    if (uploadError) {
      toast({ title: "Erro ao salvar planilha importada", description: uploadError.message, variant: "destructive" });
      return;
    }

    const { data: fileData } = await supabase
      .from("datamind_files")
      .insert([{
        conversation_id: activeConvId,
        user_id: user.id,
        file_name: `${safeName}.csv`,
        file_path: filePath,
        file_size: blob.size,
        // buildCSVBlob writes a canonical comma/UTF-8 CSV, so that is the dialect
        // the sandbox must read it back with — not whatever the source sheet used.
        schema_info: { columns, rows: rows.length, dialect: DEFAULT_DIALECT } as any,
        preview_data: rows.slice(0, 5) as any,
      }])
      .select()
      .single();

    if (fileData) {
      setFiles((prev) => [...prev, fileData as unknown as DataMindFile]);
      setSpreadsheetData({ columns, rows, dialect: DEFAULT_DIALECT, totalRows: rows.length, truncated: false });
    }

    const { data: msg } = await supabase.from("datamind_messages").insert({
      conversation_id: activeConvId,
      role: "assistant",
      content: `📊 Planilha importada do Google Sheets: **${title}** (aba "${sheet_name}", ${rows.length} linhas). Pode perguntar sobre os dados.`,
    }).select().single();
    if (msg) setMessages((prev) => [...prev, msg as Message]);

    toast({ title: "Planilha importada!", description: `${rows.length} linhas de "${sheet_name}"` });
  };

  const renameConversation = async (id: string, newTitle: string) => {
    await supabase.from("datamind_conversations").update({ title: newTitle }).eq("id", id);
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title: newTitle } : c));
  };

  const exportConversation = async (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    const { data: msgs } = await supabase
      .from("datamind_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (!msgs || msgs.length === 0) {
      toast({ title: "Nenhuma mensagem para exportar", variant: "destructive" });
      return;
    }

    const lines = [
      `# ${conv?.title || "Conversa DataMind"}`,
      `Data: ${new Date(conv?.created_at || "").toLocaleDateString("pt-BR")}`,
      "",
      ...msgs.map((m) => {
        const role = m.role === "user" ? "👤 Você" : "🤖 DataMind";
        let text = `## ${role}\n${m.content}`;
        if (m.code_block) text += `\n\n\`\`\`python\n${m.code_block}\n\`\`\``;
        if (m.output_content) text += `\n\n**Output:**\n${m.output_content}`;
        return text;
      }),
    ];

    const blob = new Blob([lines.join("\n\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(conv?.title || "conversa").replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Conversa exportada com sucesso!" });
  };

  /**
   * Downloads each file once and writes it into the chosen engine's filesystem.
   *
   * Extracted because the finding scan needs exactly this and nothing else around
   * it: the same files, in the same sandbox, without the remote-exec routing or
   * the language switch that an analysis turn goes through.
   */
  const loadFilesIntoSandbox = async (allFiles: DataMindFile[], isRCode: boolean) => {
    for (const f of allFiles) {
      const cacheKey = f.file_path + (isRCode ? "_r" : "_py");
      if (loadedFilesRef.current.has(cacheKey)) continue;
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from("datamind-files")
        .download(f.file_path);
      if (downloadError || !fileBlob) {
        throw new Error(`Falha ao carregar o arquivo "${f.file_name}" para a análise. Verifique sua conexão e tente novamente.`);
      }
      const arrayBuf = await fileBlob.arrayBuffer();
      if (isRCode) {
        await webR.writeFile(f.file_name, arrayBuf);
      } else {
        await pyodide.writeFile(f.file_name, arrayBuf);
      }
      loadedFilesRef.current.add(cacheKey);
    }
  };

  /**
   * Runs the finding scan, always in Pyodide.
   *
   * Deliberately not routed through runInSandbox: the scan is Python whatever the
   * researcher picked in the language switch, and sending it to the home server
   * would ask a container that may predate the statistics engine to answer the one
   * question that depends on it.
   */
  const runScanCode = useCallback(
    async (code: string) => {
      const filesRef = filesForScanRef.current;
      await loadFilesIntoSandbox(filesRef, false);
      const result = await pyodide.runPython(code, toSandboxFiles(filesRef));
      return { stdout: result.stdout, error: result.error };
    },
    [pyodide.runPython]
  );

  const {
    findings,
    scanning: findingsScanning,
    dismiss: dismissFinding,
    interpret: interpretFindings,
    interpreting: interpretingFindings,
    triageSummary,
  } = useDataMindFindings({
    conversationId,
    userId: user?.id,
    files,
    model: selectedModel,
    // "Deferred" in practice: the scan waits for the sandbox that is already
    // warming up in the background, so it costs the researcher no extra wait.
    ready: pyodide.status === "ready",
    runScan: runScanCode,
  });

  /**
   * Runs one block of code in whichever sandbox fits the dataset.
   *
   * Hoisted out of the assistant turn because replaying a saved pipeline executes
   * code with no model in the loop at all — that is the whole point of storing the
   * code rather than the prompt.
   */
  const runInSandbox = async (source: string, allFiles: DataMindFile[]): Promise<ExecutionResult> => {
    const isRCode = codeLanguage === "r";
    const totalRows = allFiles.reduce((sum, f) => {
      const info = f.schema_info as { rows?: number };
      return sum + (Number(info?.rows) || 0);
    }, 0);
    const canUseRemoteExec = !isRCode && isOwner && totalRows > REMOTE_EXEC_THRESHOLD_ROWS;
    setUsedRemoteExec(canUseRemoteExec);

    if (canUseRemoteExec) {
      const { data: remoteData, error: remoteError } = await supabase.functions.invoke(
        "datamind-run-remote",
        {
          body: {
            code: source,
            codeLanguage,
            // The original file name matters: it decides the dataframe variable
            // name, and the storage path carries an upload timestamp prefix.
            files: allFiles.map((f) => ({
              path: f.file_path,
              fileName: f.file_name,
              dialect: readDialect(f.schema_info),
            })),
          },
        }
      );
      if (remoteError) throw remoteError;
      return remoteData as ExecutionResult;
    }

    await loadFilesIntoSandbox(allFiles, isRCode);

    const sandboxFiles = toSandboxFiles(allFiles);
    return isRCode
      ? await webR.runR(source, sandboxFiles)
      : await pyodide.runPython(source, sandboxFiles);
  };

  /**
   * One assistant turn: ask the model, run whatever code comes back (repairing it if
   * it fails), and persist the resulting cell.
   *
   * Lifted out of sendMessage because a multi-step plan runs this exact turn once per
   * step — each with the previous steps' code and results already in its history.
   */
  const runAssistantTurn = async ({
    convId,
    message,
    history,
    schemas,
    allFiles,
    stage,
    planStep,
    heading,
  }: {
    convId: string;
    message: string;
    history: HistoryEntry[];
    schemas: FileSchemaPayload[];
    allFiles: DataMindFile[];
    /** Status line shown while this turn is generating. */
    stage: string;
    planStep?: PlanStepRef;
    /** Prepended to the persisted message, so a plan step is labelled as one. */
    heading?: string;
  }): Promise<{ message: Message | null; plan: AnalysisStep[]; explanation: string }> => {
    setLoadingStage(stage);
    const requestBody = {
      message,
      history,
      schemas,
      planStep,
      provider: selectedModel?.provider || undefined,
      model: selectedModel?.model || undefined,
      codeLanguage,
      stream: true,
    };

    // Streamed through a raw fetch rather than functions.invoke, which buffers the
    // whole body. The function falls back to a plain JSON response whenever the
    // chosen provider cannot stream, so both shapes are handled here.
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const chatResponse = await fetch(DATAMIND_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(requestBody),
    });

    if (!chatResponse.ok) {
      throw new Error(`datamind-chat respondeu ${chatResponse.status}`);
    }

    let reply: AssistantReply;

    if (chatResponse.headers.get("content-type")?.includes("text/event-stream")) {
      const raw = await readAssistantStream(chatResponse, {
        onText: (soFar) => {
          // The prompt puts "explanation" first precisely so it can be shown
          // while the code field is still being generated.
          const prefix = extractExplanationPrefix(soFar);
          if (prefix) setStreamingText(prefix);
        },
      });
      reply = parseAssistantReply(raw);
    } else {
      const json = await chatResponse.json();
      reply = {
        explanation: json?.explanation || "",
        code: json?.code || null,
        plan: normalizePlan(json?.plan),
      };
    }

    setStreamingText("");

    // A plan is not executed here: the caller announces it and then drives one
    // turn per step, so each step can see what the step before it produced.
    if (!planStep && reply.plan.length > 0) {
      return { message: null, plan: reply.plan, explanation: reply.explanation };
    }

    const aiContent = reply.explanation || "Não consegui processar sua solicitação.";
    // The synthesis turn interprets results that already exist; code there would
    // just re-run an analysis the researcher has already seen.
    const codeBlock = planStep?.final ? null : reply.code;

    // Execute code if present
    let outputType: string | null = null;
    let outputContent: string | null = null;
    // The code that actually ran, which may be a repaired version of what the
    // model first produced — that is what gets stored and shown.
    let executedCode: string | null = codeBlock;
    let fixNote = "";
    let autoFixed = false;

    if (codeBlock && allFiles.length > 0) {
      try {
        setLoadingStage("Executando a análise...");
        let result = await runInSandbox(executedCode, allFiles);

        // Self-repair loop: a traceback is something the model can act on, and
        // making the researcher debug generated code is the difference between a
        // tool that "always works" and one that fails in their face.
        let attempt = 0;
        while (result.error && attempt < MAX_FIX_ATTEMPTS) {
          attempt++;
          setLoadingStage(
            attempt === 1
              ? "O código falhou — corrigindo e tentando de novo..."
              : `Corrigindo o código (tentativa ${attempt} de ${MAX_FIX_ATTEMPTS})...`
          );

          const { data: fixData, error: fixError } = await supabase.functions.invoke("datamind-fix", {
            body: {
              code: executedCode,
              error: result.error,
              codeLanguage,
              schemas,
              provider: selectedModel?.provider || undefined,
              model: selectedModel?.model || undefined,
            },
          });

          // No code back means the fixer judged the analysis impossible, or itself
          // failed; its note explains that far better than a raw traceback.
          if (fixError || !fixData?.code) {
            if (fixData?.note) fixNote = fixData.note;
            break;
          }

          fixNote = fixData.note || fixNote;
          executedCode = fixData.code;
          setLoadingStage("Executando a análise corrigida...");
          result = await runInSandbox(executedCode, allFiles);
        }

        if (result.error) {
          outputType = "text";
          outputContent = [
            attempt > 0
              ? `Não consegui executar esta análise, mesmo após ${attempt} tentativa(s) de correção automática.`
              : "Não consegui executar esta análise.",
            fixNote ? `Motivo: ${fixNote}` : "",
            `Detalhe técnico:${NL}${result.error}`,
          ]
            .filter(Boolean)
            .join(NL + NL);
        } else {
          const parts: string[] = [];
          if (result.stdout?.trim()) {
            parts.push(result.stdout.trim());
          }
          if (result.images.length > 0) {
            result.images.forEach((img) => {
              parts.push(`[IMG]data:image/png;base64,${img}[/IMG]`);
            });
          }
          if (parts.length > 0) {
            outputType = result.images.length > 0 ? "mixed" : "text";
            outputContent = parts.join(NL);
          } else {
            outputType = "text";
            outputContent = "Código executado com sucesso (sem output).";
          }
          // Flagged so the UI can say the code shown is a repaired version, not
          // the one first generated.
          if (attempt > 0) autoFixed = true;
        }
      } catch (e) {
        console.error("Execution error:", e);
        outputType = "text";
        outputContent = e instanceof Error && e.message.startsWith("Falha ao carregar o arquivo")
          ? e.message
          : "Erro ao executar o código no navegador.";
      }
    }

    const withFixNote = autoFixed
      ? `${aiContent}${NL}${NL}_O código falhou na primeira execução e foi corrigido automaticamente._`
      : aiContent;

    const { data: aiMsg } = await supabase
      .from("datamind_messages")
      .insert({
        conversation_id: convId,
        role: "assistant",
        content: heading ? `${heading}${NL}${NL}${withFixNote}` : withFixNote,
        code_block: executedCode,
        output_type: outputType,
        output_content: outputContent,
      })
      .select()
      .single();

    if (aiMsg) setMessages((prev) => [...prev, aiMsg as Message]);
    return { message: (aiMsg as Message) || null, plan: [], explanation: reply.explanation };
  };

  /**
   * Runs a plan the model proposed and the researcher's question implied: one cell per
   * step, each seeing the code and results of the steps before it, then a closing
   * synthesis that answers the original question from the numbers that came out.
   */
  const runPlan = async ({
    convId,
    question,
    plan,
    explanation,
    history,
    schemas,
    allFiles,
  }: {
    convId: string;
    question: string;
    plan: AnalysisStep[];
    explanation: string;
    history: HistoryEntry[];
    schemas: FileSchemaPayload[];
    allFiles: DataMindFile[];
  }) => {
    planAbortRef.current = false;
    setPlanRunning(true);

    const announcement = [explanation.trim(), formatPlanAnnouncement(plan)]
      .filter(Boolean)
      .join(NL + NL);

    const { data: planMsg } = await supabase
      .from("datamind_messages")
      .insert({ conversation_id: convId, role: "assistant", content: announcement })
      .select()
      .single();
    if (planMsg) setMessages((prev) => [...prev, planMsg as Message]);

    // setMessages has not flushed while this loop runs, so what the steps produced is
    // accumulated here and condensed the same way a normal follow-up would be. Only
    // the tail of the pre-plan history is carried: the edge function keeps a limited
    // window, and inside a plan the step results are what the next step needs.
    const stepMessages: Message[] = [];
    const historyFor = (): HistoryEntry[] => [
      ...history.slice(-2),
      { role: "user", content: question },
      ...buildHistory(stepMessages),
    ];

    try {
      for (let i = 0; i < plan.length; i++) {
        if (planAbortRef.current) break;
        const step = plan[i];
        const turn = await runAssistantTurn({
          convId,
          message: buildStepMessage(question, plan, i),
          history: historyFor(),
          schemas,
          allFiles,
          stage: formatStepStage(step, i, plan.length),
          planStep: { index: i, total: plan.length },
          heading: formatStepHeading(step, i, plan.length),
        });
        if (turn.message) stepMessages.push(turn.message);
      }

      if (planAbortRef.current) {
        const { data: stopMsg } = await supabase
          .from("datamind_messages")
          .insert({
            conversation_id: convId,
            role: "assistant",
            content: `_Plano interrompido após ${stepMessages.length} de ${plan.length} etapas. Os resultados já obtidos continuam acima._`,
          })
          .select()
          .single();
        if (stopMsg) setMessages((prev) => [...prev, stopMsg as Message]);
        return;
      }

      // Without this the researcher is left holding N cells and no answer. It reads
      // the numbers already produced, so it generates no code of its own.
      await runAssistantTurn({
        convId,
        message: buildSynthesisMessage(question, plan),
        history: historyFor(),
        schemas,
        allFiles,
        stage: "Consolidando os resultados das etapas...",
        planStep: { index: plan.length, total: plan.length, final: true },
        heading: "### Síntese final",
      });
    } finally {
      setPlanRunning(false);
      planAbortRef.current = false;
    }
  };

  const sendMessage = async (content: string, file?: File) => {
    if (!user) return;
    if (!canUse("datamind_chat")) {
      setShowDmLimitDialog(true);
      return;
    }
    setLoading(true);

    let activeConvId = conversationId;
    if (!activeConvId) {
      const newId = await createConversation(content.slice(0, 60));
      if (!newId) { setLoading(false); return; }
      activeConvId = newId;
    }

    // Handle file upload
    let uploadedFile: DataMindFile | null = null;
    if (file) {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("datamind-files")
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
        setLoading(false);
    setLoadingStage(null);
    setStreamingText("");
        return;
      }

      // Parse once, up front: the same ParsedTable feeds the grid, the preview and
      // the schema, and its dialect is what the sandbox will read the file with.
      let previewData: unknown[] = [];
      let schemaInfo: Record<string, unknown> = {};
      const isExcel = /\.xlsx?$/i.test(file.name);
      try {
        const buffer = await file.arrayBuffer();
        const table = isExcel ? parseExcelFull(buffer) : parseCSVFull(buffer);

        if (table && table.columns.length > 0) {
          // The profile is computed once here and stored with the file, so every
          // later request can hand the model real types, levels and data-quality
          // flags instead of a bare column list.
          schemaInfo = {
            columns: table.columns,
            rows: table.totalRows,
            dialect: table.dialect,
            profile: compactProfile(profileDataset(table), table.totalRows),
          };
          previewData = table.rows.slice(0, 5);

          if (table.truncated) {
            toast({
              title: "Arquivo grande",
              description: `A planilha mostra as primeiras ${MAX_ROWS.toLocaleString("pt-BR")} de ${table.totalRows.toLocaleString("pt-BR")} linhas. A análise usa o arquivo completo.`,
            });
          }
        } else if (isExcel) {
          schemaInfo = {
            file_type: "excel",
            file_name: file.name,
            file_size: file.size,
            note: "Excel file - schema will be detected by Python/pandas",
          };
        }
      } catch (e) {
        console.error("File parse error:", e);
      }

      const { data: fileData } = await supabase
        .from("datamind_files")
        .insert([{
          conversation_id: activeConvId,
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          schema_info: schemaInfo as any,
          preview_data: previewData as any,
        }])
        .select()
        .single();
      if (fileData) {
        uploadedFile = fileData as unknown as DataMindFile;
        setFiles((prev) => [...prev, uploadedFile!]);
        // Auto-show profiler on upload
        if (!profilingDone) {
          setShowProfiler(true);
          setProfilingDone(true);
        }
      }
    }

    // Build content with selected context
    let fullContent = content;
    if (selectedContext && selectedContext.data.length > 0) {
      if (selectedContext.data.length > 1000) {
        toast({
          title: "Seleção muito grande",
          description: "Mais de 1000 linhas selecionadas. Use Python/Pandas para analisar o arquivo inteiro.",
          variant: "destructive",
        });
      }
      // Convert selected data to CSV string
      const headers = Object.keys(selectedContext.data[0]);
      const csvLines = [
        headers.join(","),
        ...selectedContext.data.slice(0, 1000).map((row) =>
          headers.map((h) => row[h] ?? "").join(",")
        ),
      ];
      fullContent = `${content}\n\n[Contexto selecionado da planilha (${selectedContext.summary})]\n\`\`\`csv\n${csvLines.join("\n")}\n\`\`\``;
    }

    // Save user message
    const userMsgContent = file
      ? `${content}\n\n📎 Arquivo: **${file.name}**`
      : content;

    const { data: userMsg } = await supabase
      .from("datamind_messages")
      .insert({
        conversation_id: activeConvId,
        role: "user",
        content: userMsgContent,
      })
      .select()
      .single();

    if (userMsg) setMessages((prev) => [...prev, userMsg]);

    // Clear selection after send
    setSelectedContext(null);

    // Call AI
    try {
      // All files in the conversation (including one just uploaded) are available as context —
      // `files` state won't include `uploadedFile` yet since setFiles hasn't flushed.
      const allFiles = uploadedFile ? [...files, uploadedFile] : files;

      const schemas = allFiles.map((f) => {
        const info = f.schema_info as { columns?: string[]; rows?: number; profile?: CompactProfile };
        return {
          file_name: f.file_name,
          columns: info?.columns || [],
          rows: info?.rows,
          profile: info?.profile,
        };
      });

      // Past assistant turns carry their code and results, so a follow-up such as
      // "interprete isso" is answered from the numbers that were actually produced.
      // The current message is excluded: it is sent separately as `message`.
      const history = buildHistory(messages);

      const firstTurn = await runAssistantTurn({
        convId: activeConvId,
        message: fullContent,
        history,
        schemas,
        allFiles,
        stage: allFiles.length > 0 ? "Lendo o perfil dos dados e escolhendo a análise..." : "Pensando...",
      });

      // A single-cell answer is already done; only a real plan continues below.
      if (firstTurn.plan.length > 0) {
        await runPlan({
          convId: activeConvId,
          question: fullContent,
          plan: firstTurn.plan,
          explanation: firstTurn.explanation,
          history,
          schemas,
          allFiles,
        });
      }
    } catch (err) {
      console.error("AI error:", err);
      const { data: errMsg } = await supabase
        .from("datamind_messages")
        .insert({
          conversation_id: activeConvId,
          role: "assistant",
          content: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.",
        })
        .select()
        .single();
      if (errMsg) setMessages((prev) => [...prev, errMsg]);
    }

    // Update conversation title if first message
    if (messages.length === 0) {
      await supabase
        .from("datamind_conversations")
        .update({ title: content.slice(0, 60) })
        .eq("id", activeConvId);
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId ? { ...c, title: content.slice(0, 60) } : c))
      );
    }

    setLoading(false);
    setLoadingStage(null);
    setStreamingText("");
  };

  /**
   * Replays a saved pipeline by re-running its stored code, not by re-asking the
   * model its prompts.
   *
   * Re-sending the prompts regenerated the code every time, so "apply the same
   * pipeline to this month's data" could quietly run a different analysis than the
   * one that was saved — the opposite of what a pipeline is for. Replaying the code
   * makes the result reproducible, and costs no AI call at all.
   *
   * Steps saved before the code was stored have only a prompt; those still go
   * through the model, and the message says so.
   */
  const applyPipelineSteps = async (steps: { prompt: string; code: string }[]) => {
    if (!user) return;
    let activeConvId = conversationId;
    if (!activeConvId) {
      activeConvId = await createConversation("Pipeline aplicado");
      if (!activeConvId) return;
    }

    setLoading(true);
    let replayed = 0;
    let regenerated = 0;
    let failed = 0;

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        if (!step.code) {
          // No stored code: the only way to run this step is to ask the model again.
          if (step.prompt) {
            await sendMessage(step.prompt);
            regenerated++;
          }
          continue;
        }

        setLoadingStage(`Reexecutando etapa ${i + 1} de ${steps.length} do pipeline...`);

        let outputType = "text";
        let outputContent: string;
        try {
          const result = await runInSandbox(step.code, files);
          if (result.error) {
            failed++;
            outputContent = `Esta etapa do pipeline falhou nos dados atuais.${NL}${NL}Detalhe técnico:${NL}${result.error}`;
          } else {
            const parts: string[] = [];
            if (result.stdout?.trim()) parts.push(result.stdout.trim());
            result.images.forEach((img) => parts.push(`[IMG]data:image/png;base64,${img}[/IMG]`));
            outputType = result.images.length > 0 ? "mixed" : "text";
            outputContent = parts.length > 0 ? parts.join(NL) : "Código executado com sucesso (sem output).";
            replayed++;
          }
        } catch (e) {
          failed++;
          outputContent = e instanceof Error && e.message.startsWith("Falha ao carregar o arquivo")
            ? e.message
            : "Erro ao executar o código desta etapa.";
        }

        const heading = `### Etapa ${i + 1} de ${steps.length} do pipeline`;
        const description = step.prompt || "Etapa salva do pipeline";
        const { data: msg } = await supabase
          .from("datamind_messages")
          .insert({
            conversation_id: activeConvId,
            role: "assistant",
            content: `${heading}${NL}${NL}${description}${NL}${NL}_Código salvo reexecutado sem passar pela IA, então o resultado é reprodutível._`,
            code_block: step.code,
            output_type: outputType,
            output_content: outputContent,
          })
          .select()
          .single();
        if (msg) setMessages((prev) => [...prev, msg as Message]);
      }
    } finally {
      setLoading(false);
      setLoadingStage(null);
    }

    const summary = [
      replayed > 0 ? `${replayed} reexecutada(s)` : "",
      regenerated > 0 ? `${regenerated} regerada(s) pela IA por não ter código salvo` : "",
      failed > 0 ? `${failed} com erro` : "",
    ].filter(Boolean).join(", ");
    toast({
      title: failed > 0 ? "Pipeline aplicado com falhas" : "Pipeline aplicado!",
      description: summary || `${steps.length} etapas executadas.`,
      variant: failed > 0 ? "destructive" : undefined,
    });
  };

  // Auto-open apply dialog if pipeline param
  useEffect(() => {
    const pipelineId = searchParams.get("pipeline");
    if (pipelineId) {
      setApplyPipelineOpen(true);
      setSearchParams({});
    }
  }, [searchParams]);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar toggle */}
        <div className="relative">
          {sidebarOpen && (
            <div className="flex flex-col h-full">
              <DataMindSidebar
                conversations={conversations}
                activeId={conversationId}
                onSelect={(id) => navigate(`/datamind/${id}`)}
                onNew={() => navigate("/datamind")}
                onDelete={deleteConversation}
                onRename={renameConversation}
                onExport={exportConversation}
                selectedIds={selectedConvIds}
                onToggleSelect={toggleSelectConv}
                selectionMode={selectionMode}
                onToggleSelectionMode={toggleSelectionMode}
              />
              <div className="w-64 border-r border-border/30 bg-sidebar-background px-3 pb-3">
                <DataMindDbConnections
                  selectedId={activeDbConnection?.id}
                  onSelect={setActiveDbConnection}
                />
              </div>
            </div>
          )}
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="border-b border-border/40 px-4 py-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8 shrink-0"
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            <div className="ml-auto flex items-center gap-1 flex-wrap justify-end">
              {/* Bulk actions */}
              {selectionMode && selectedConvIds.size > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-7"
                    onClick={bulkShare}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Compartilhar ({selectedConvIds.size})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive"
                    onClick={() => setBulkDeleteOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir ({selectedConvIds.size})
                  </Button>
                  <div className="w-px h-5 bg-border/50 mx-1" />
                </>
              )}
              {messages.length > 0 && (
                <DataMindAutoReport
                  messages={messages}
                  files={files}
                  conversationTitle={conversations.find((c) => c.id === conversationId)?.title}
                  findings={findings}
                />
              )}
              {conversationId && (
                <DataMindCollaboration conversationId={conversationId} />
              )}
              {conversationId && (
                <LinkToProjectButton
                  resourceType="datamind"
                  resourceId={conversationId}
                  label={conversations.find((c) => c.id === conversationId)?.title || "Análise DataMind"}
                  attachTable="datamind_conversations"
                  variant="ghost"
                  linked={linkedDataMindIds.has(conversationId)}
                />
              )}
              {conversationId && messages.length > 0 && (
                <RegisterOutputButton
                  defaultTitle={conversations.find((c) => c.id === conversationId)?.title || "Análise DataMind"}
                  outputType="analysis"
                  description="Análise/relatório gerado no DataMind."
                  url={`/datamind/${conversationId}`}
                  linkType="datamind"
                  linkResourceId={conversationId}
                  variant="ghost"
                />
              )}
              {conversationId && messages.length > 0 && (
                <DataMindVersioning
                  conversationId={conversationId}
                  messages={messages}
                  onRestore={(restored) => setMessages(restored)}
                />
              )}
              {spreadsheetData && spreadsheetData.columns.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-7"
                    onClick={() => setShowProfiler(!showProfiler)}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Perfil
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-7"
                    onClick={() => setCleaningOpen(!cleaningOpen)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Limpeza
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-7"
                    onClick={() => setHeatmapOpen(true)}
                    title="Sobrepor dados como mapa de calor em uma imagem"
                  >
                    <Flame className="h-3.5 w-3.5" />
                    Mapa de calor
                  </Button>
                </>
              )}
              {messages.length > 0 && (
                <SavePipelineDialog
                  messages={messages}
                  conversationTitle={conversations.find((c) => c.id === conversationId)?.title}
                />
              )}
              {files.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => setApplyPipelineOpen(true)}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  Aplicar Pipeline
                </Button>
              )}
              <DataMindStatsMenu
                onInsertPrompt={(prompt) => sendMessage(prompt)}
                disabled={loading}
              />
              <DataMindModelSelector value={selectedModel} onChange={setSelectedModel} />
              {usedRemoteExec && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs h-7 px-2.5 rounded-md bg-primary/10 text-primary"
                  title="Última análise executada no servidor remoto (dataset grande)"
                >
                  <Server className="h-3.5 w-3.5" />
                  Servidor remoto
                </span>
              )}
              <DataMindSandboxPanel codeLanguage={codeLanguage} onLanguageChange={setCodeLanguage} pyodideStatus={pyodide.status} onReset={pyodide.reset} onInit={pyodide.init} webRStatus={webR.status} onWebRInit={webR.init} onWebRReset={webR.reset} />
            </div>
          </div>

          {/* DB Query widget */}
          {activeDbConnection && (
            <div className="px-4 py-3 border-b border-border/30">
              <DataMindDbQuery
                connection={activeDbConnection}
                onResultToChat={(question, sql, result) => {
                  const csvHeader = result.columns.join(",");
                  const csvRows = result.rows.slice(0, 200).map(r => r.join(",")).join("\n");
                  const msg = `Consultei o banco "${activeDbConnection.name}" com a pergunta: "${question}"\n\nSQL gerado:\n\`\`\`sql\n${sql}\n\`\`\`\n\nResultado (${result.rowCount} linhas, mostrando até 200):\n\`\`\`csv\n${csvHeader}\n${csvRows}\n\`\`\`\n\nAnalise estes dados.`;
                  sendMessage(msg);
                }}
              />
            </div>
          )}

          {/* Data Cleaning Panel */}
          {cleaningOpen && spreadsheetData && (
            <div className="px-4 py-3 border-b border-border/30">
              <DataCleaningPanel
                data={spreadsheetData}
                conversationId={conversationId}
                fileId={files[0]?.id}
                onApply={(cleaned) => {
                  // Cleaning rewrites rows, not how the file is read — keep the
                  // dialect so a later sandbox run still parses it the same way.
                  setSpreadsheetData({
                    ...cleaned,
                    dialect: cleaned.dialect ?? spreadsheetData.dialect,
                    totalRows: cleaned.totalRows ?? cleaned.rows.length,
                    truncated: cleaned.truncated ?? spreadsheetData.truncated,
                  });
                  setCleaningOpen(false);
                }}
                onClose={() => setCleaningOpen(false)}
              />
            </div>
          )}

          {/* Smart Data Profiler */}
          {showProfiler && spreadsheetData && spreadsheetData.columns.length > 0 && (
            <div className="px-4 py-3 border-b border-border/30">
              <DataMindProfiler
                data={spreadsheetData}
                fileName={files[0]?.file_name || "dataset"}
                onClose={() => setShowProfiler(false)}
                onSendToChat={(msg) => { setShowProfiler(false); sendMessage(msg); }}
              />
            </div>
          )}

          <DataMindChat
            messages={messages}
            files={files}
            loading={loading}
            loadingStage={loadingStage}
            streamingText={streamingText}
            conversationId={conversationId}
            onSend={sendMessage}
            hasConversation={!!conversationId}
            existingFiles={files}
            spreadsheetData={spreadsheetData}
            selectedContext={selectedContext}
            onSelectionChange={setSelectedContext}
            onOpenGoogleSheetsImport={() => setGoogleSheetsOpen(true)}
            findings={findings}
            findingsScanning={findingsScanning}
            onDismissFinding={dismissFinding}
            onInterpretFindings={interpretFindings}
            interpretingFindings={interpretingFindings}
            triageSummary={triageSummary}
            selectedModel={selectedModel}
            planRunning={planRunning}
            onCancelPlan={() => {
              planAbortRef.current = true;
              toast({ title: "Plano será interrompido", description: "A etapa em andamento ainda vai terminar." });
            }}
          />
        </div>
      </div>

      <ApplyPipelineDialog
        open={applyPipelineOpen}
        onOpenChange={setApplyPipelineOpen}
        onApply={applyPipelineSteps}
      />

      <GoogleSheetsImportDialog
        open={googleSheetsOpen}
        onOpenChange={setGoogleSheetsOpen}
        onImport={importGoogleSheet}
      />

      <HeatmapOverlayDialog
        open={heatmapOpen}
        onOpenChange={setHeatmapOpen}
        data={spreadsheetData}
        fileName={files[0]?.file_name}
        onResult={async (pngUrl) => {
          if (!user) return;
          try {
            const blob = await fetch(pngUrl).then((r) => r.blob());
            const path = `${user.id}/heatmaps/heatmap-${Date.now()}.png`;
            const { error: upErr } = await supabase.storage.from("datamind-files").upload(path, blob, { contentType: "image/png" });
            if (upErr) throw upErr;
            const { data: signed } = await supabase.storage.from("datamind-files").createSignedUrl(path, 60 * 60 * 24 * 365);
            const url = signed?.signedUrl || pngUrl;
            const md = `Gerei um mapa de calor a partir dos seus dados.\n\n![Mapa de calor](${url})\n\n[Baixar PNG](${url})`;
            let activeConvId = conversationId;
            if (!activeConvId) {
              activeConvId = await createConversation("Mapa de calor");
              if (!activeConvId) return;
            }
            const { data: inserted } = await supabase.from("datamind_messages").insert({
              conversation_id: activeConvId,
              role: "assistant",
              content: md,
            }).select().single();
            if (inserted) setMessages((prev) => [...prev, inserted as Message]);
            toast({ title: "Mapa de calor salvo na conversa" });
          } catch (e: any) {
            toast({ title: "Falha ao salvar", description: e?.message, variant: "destructive" });
          }
        }}
      />


      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar {selectedConvIds.size} conversa(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Todas as mensagens e arquivos das conversas selecionadas serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                bulkDelete();
                setBulkDeleteOpen(false);
              }}
            >
              Apagar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UsageLimitDialog feature="datamind_chat" open={showDmLimitDialog} onOpenChange={setShowDmLimitDialog} />
    </div>
  );
};

export default DataMind;
