import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { linkResource } from "@/lib/research/integrations";
import { useSubscription } from "@/hooks/useSubscription";
import { UsageLimitDialog } from "@/components/app/UpgradeGate";
import { supabase } from "@/integrations/supabase/client";
import { usePyodide, PyodideStatus } from "@/hooks/usePyodide";
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
import * as XLSX from "xlsx";
import { LinkToProjectButton } from "@/components/research/LinkToProjectButton";
import { RegisterOutputButton } from "@/components/research/RegisterOutputButton";

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
}

export interface SelectedContext {
  data: Record<string, string>[];
  summary: string;
}

const MAX_ROWS = 50000;
// Above this combined row count, execution routes to the owner's home-server sandbox
// instead of the in-browser Pyodide (see supabase/functions/datamind-run-remote).
const REMOTE_EXEC_THRESHOLD_ROWS = 50000;

const DataMind = () => {
  const { id: conversationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProjectId } = useActiveProject();
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
  const [selectedModel, setSelectedModel] = useState<{ provider: string; model: string } | null>(null);
  const [codeLanguage, setCodeLanguage] = useState("python");
  const pyodide = usePyodide();
  const webR = useWebR();
  const loadedFilesRef = useRef<Set<string>>(new Set());
  const [applyPipelineOpen, setApplyPipelineOpen] = useState(false);
  const [activeDbConnection, setActiveDbConnection] = useState<any>(null);
  const [cleaningOpen, setCleaningOpen] = useState(false);
  const [showProfiler, setShowProfiler] = useState(false);
  const [profilingDone, setProfilingDone] = useState(false);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [googleSheetsOpen, setGoogleSheetsOpen] = useState(false);
  const [usedRemoteExec, setUsedRemoteExec] = useState(false);

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

      if (file.file_name.endsWith(".csv")) {
        const text = await blob.text();
        parseCSVFull(text);
      } else if (file.file_name.match(/\.xlsx?$/i)) {
        const buffer = await blob.arrayBuffer();
        parseExcelFull(buffer);
      }
    } catch (e) {
      console.error("Failed to re-parse file for spreadsheet:", e);
    }
  };

  const parseCSVFull = (text: string) => {
    const lines = text.split("\n").filter(Boolean);
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
    const rows = lines.slice(1, MAX_ROWS + 1).map((line) => {
      const vals = line.split(",").map((v) => v.trim().replace(/"/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => (row[h] = vals[i] || ""));
      return row;
    });
    setSpreadsheetData({ columns: headers, rows });
  };

  const parseExcelFull = (buffer: ArrayBuffer) => {
    try {
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (jsonData.length === 0) return;

      const headers = Object.keys(jsonData[0]);
      const rows = jsonData.slice(0, MAX_ROWS).map((row) => {
        const r: Record<string, string> = {};
        headers.forEach((h) => (r[h] = String(row[h] ?? "")));
        return r;
      });
      setSpreadsheetData({ columns: headers, rows });
    } catch (e) {
      console.error("Excel parse error:", e);
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
  const buildCSVBlob = (columns: string[], rows: Record<string, string>[]): Blob => {
    const escapeCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [
      columns.map(escapeCell).join(","),
      ...rows.map((row) => columns.map((c) => escapeCell(row[c] ?? "")).join(",")),
    ];
    return new Blob([lines.join("\n")], { type: "text/csv" });
  };

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
        schema_info: { columns, rows: rows.length } as any,
        preview_data: rows.slice(0, 5) as any,
      }])
      .select()
      .single();

    if (fileData) {
      setFiles((prev) => [...prev, fileData as unknown as DataMindFile]);
      setSpreadsheetData({ columns, rows });
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
        return;
      }

      // Parse file preview client-side
      let previewData: unknown[] = [];
      let schemaInfo: Record<string, unknown> = {};
      const isExcel = file.name.match(/\.xlsx?$/i);
      if (file.name.endsWith(".csv")) {
        try {
          const text = await file.text();
          const lines = text.split("\n").filter(Boolean);
          const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
          schemaInfo = { columns: headers, rows: lines.length - 1 };
          previewData = lines.slice(1, 6).map((line) => {
            const vals = line.split(",").map((v) => v.trim().replace(/"/g, ""));
            const row: Record<string, string> = {};
            headers.forEach((h, i) => (row[h] = vals[i] || ""));
            return row;
          });
          // Full parse for spreadsheet
          parseCSVFull(text);
        } catch { /* ignore parse errors */ }
      } else if (isExcel) {
        try {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
          if (jsonData.length > 0) {
            const headers = Object.keys(jsonData[0]);
            schemaInfo = { columns: headers, rows: jsonData.length };
            previewData = jsonData.slice(0, 5).map((row) => {
              const r: Record<string, string> = {};
              headers.forEach((h) => (r[h] = String(row[h] ?? "")));
              return r;
            });
            // Full parse for spreadsheet
            parseExcelFull(buffer);
          }
        } catch {
          schemaInfo = { file_type: "excel", file_name: file.name, file_size: file.size, note: "Excel file - schema will be detected by Python/pandas" };
        }
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
        const info = f.schema_info as { columns?: string[]; rows?: number };
        return { file_name: f.file_name, columns: info?.columns || [], rows: info?.rows };
      });

      const history = [...messages, userMsg].filter(Boolean).slice(-10).map((m) => ({
        role: m!.role,
        content: m!.content,
      }));

      const { data: aiResponse, error: aiError } = await supabase.functions.invoke(
        "datamind-chat",
        {
          body: {
            message: fullContent,
            history,
            schemas,
            provider: selectedModel?.provider || undefined,
            model: selectedModel?.model || undefined,
            codeLanguage,
          },
        }
      );

      if (aiError) throw aiError;

      const aiContent = aiResponse?.explanation || "Não consegui processar sua solicitação.";
      const codeBlock = aiResponse?.code || null;

      // Execute code if present
      let outputType: string | null = null;
      let outputContent: string | null = null;

      if (codeBlock && allFiles.length > 0) {
        try {
          const isRCode = codeLanguage === "r";
          const totalRows = allFiles.reduce((sum, f) => {
            const info = f.schema_info as { rows?: number };
            return sum + (Number(info?.rows) || 0);
          }, 0);
          const canUseRemoteExec = !isRCode && isOwner && totalRows > REMOTE_EXEC_THRESHOLD_ROWS;
          setUsedRemoteExec(canUseRemoteExec);

          let result: { stdout: string; images: string[]; error: string | null };

          if (canUseRemoteExec) {
            const { data: remoteData, error: remoteError } = await supabase.functions.invoke(
              "datamind-run-remote",
              { body: { code: codeBlock, codeLanguage, filePaths: allFiles.map((f) => f.file_path) } }
            );
            if (remoteError) throw remoteError;
            result = remoteData;
          } else {
            for (const f of allFiles) {
              const cacheKey = f.file_path + (isRCode ? "_r" : "_py");
              if (loadedFilesRef.current.has(cacheKey)) continue;
              const { data: fileBlob } = await supabase.storage
                .from("datamind-files")
                .download(f.file_path);
              if (!fileBlob) continue;
              const arrayBuf = await fileBlob.arrayBuffer();
              if (isRCode) {
                await webR.writeFile(f.file_name, arrayBuf);
              } else {
                await pyodide.writeFile(f.file_name, arrayBuf);
              }
              loadedFilesRef.current.add(cacheKey);
            }

            const fileNames = allFiles.map((f) => f.file_name);
            result = isRCode
              ? await webR.runR(codeBlock, fileNames)
              : await pyodide.runPython(codeBlock, fileNames);
          }

          if (result.error) {
            outputType = "text";
            outputContent = `Erro na execução:\n${result.error}`;
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
              outputContent = parts.join("\n");
            } else {
              outputType = "text";
              outputContent = "Código executado com sucesso (sem output).";
            }
          }
        } catch (e) {
          console.error("Execution error:", e);
          outputType = "text";
          outputContent = "Erro ao executar o código no navegador.";
        }
      }

      const { data: aiMsg } = await supabase
        .from("datamind_messages")
        .insert({
          conversation_id: activeConvId,
          role: "assistant",
          content: aiContent,
          code_block: codeBlock,
          output_type: outputType,
          output_content: outputContent,
        })
        .select()
        .single();

      if (aiMsg) setMessages((prev) => [...prev, aiMsg]);
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
  };

  // Apply pipeline: sequentially send each step's prompt
  const applyPipelineSteps = async (steps: { prompt: string; code: string }[]) => {
    for (const step of steps) {
      if (step.prompt) {
        await sendMessage(step.prompt);
        // Small delay between steps for readability
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    toast({ title: "Pipeline aplicado!", description: `${steps.length} etapas executadas.` });
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
                  setSpreadsheetData(cleaned);
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
            conversationId={conversationId}
            onSend={sendMessage}
            hasConversation={!!conversationId}
            existingFiles={files}
            spreadsheetData={spreadsheetData}
            selectedContext={selectedContext}
            onSelectionChange={setSelectedContext}
            onOpenGoogleSheetsImport={() => setGoogleSheetsOpen(true)}
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
