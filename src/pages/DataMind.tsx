import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePyodide, PyodideStatus } from "@/hooks/usePyodide";
// AppSidebar provided by ProtectedRoute
import DataMindSidebar from "@/components/datamind/DataMindSidebar";
import DataMindChat from "@/components/datamind/DataMindChat";
import DataMindModelSelector from "@/components/datamind/DataMindModelSelector";
import DataMindSandboxPanel from "@/components/datamind/DataMindSandboxPanel";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

const DataMind = () => {
  const { id: conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<DataMindFile[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{ provider: string; model: string } | null>(null);
  const [codeLanguage, setCodeLanguage] = useState("python");
  const pyodide = usePyodide();
  const loadedFilesRef = useRef<Set<string>>(new Set());

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

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setFiles([]);
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
      if (fileRes.data) setFiles(fileRes.data as unknown as DataMindFile[]);
    };
    loadMessages();
  }, [conversationId]);

  const createConversation = async (title?: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("datamind_conversations")
      .insert({ user_id: user.id, title: title || "Nova análise" })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro ao criar conversa", variant: "destructive" });
      return null;
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
        } catch { /* ignore parse errors */ }
      } else if (isExcel) {
        // For Excel files, we can't parse client-side easily, but provide file info
        schemaInfo = { file_type: "excel", file_name: file.name, file_size: file.size, note: "Excel file - schema will be detected by Python/pandas" };
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
      }
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

    // Call AI
    try {
      const schemaContext = files.length > 0
        ? JSON.stringify(files[0].schema_info)
        : uploadedFile
          ? JSON.stringify(uploadedFile.schema_info)
          : "";

      const history = [...messages, userMsg].filter(Boolean).slice(-10).map((m) => ({
        role: m!.role,
        content: m!.content,
      }));

      const { data: aiResponse, error: aiError } = await supabase.functions.invoke(
        "datamind-chat",
        {
          body: {
            message: content,
            history,
            schema: schemaContext,
            file_name: uploadedFile?.file_name || files[0]?.file_name || "",
            provider: selectedModel?.provider || undefined,
            model: selectedModel?.model || undefined,
          },
        }
      );

      if (aiError) throw aiError;

      const aiContent = aiResponse?.explanation || "Não consegui processar sua solicitação.";
      const codeBlock = aiResponse?.code || null;

      // Execute code if present
      let outputType: string | null = null;
      let outputContent: string | null = null;

      if (codeBlock && (uploadedFile || files.length > 0)) {
        const targetFile = uploadedFile || files[0];
        try {
          // Load file into Pyodide if not already loaded
          if (!loadedFilesRef.current.has(targetFile.file_path)) {
            const { data: fileBlob } = await supabase.storage
              .from("datamind-files")
              .download(targetFile.file_path);
            if (fileBlob) {
              const arrayBuf = await fileBlob.arrayBuffer();
              await pyodide.writeFile(targetFile.file_name, arrayBuf);
              loadedFilesRef.current.add(targetFile.file_path);
            }
          }

          const result = await pyodide.runPython(codeBlock, targetFile.file_name);

          if (result.error) {
            outputType = "text";
            outputContent = `Erro na execução:\n${result.error}`;
          } else {
            // Build combined output: text + images
            const parts: string[] = [];
            if (result.stdout?.trim()) {
              parts.push(result.stdout.trim());
            }
            if (result.images.length > 0) {
              // Encode images as special markers for the renderer
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

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar toggle */}
        <div className="relative">
          {sidebarOpen && (
            <DataMindSidebar
              conversations={conversations}
              activeId={conversationId}
              onSelect={(id) => navigate(`/datamind/${id}`)}
              onNew={() => navigate("/datamind")}
              onDelete={deleteConversation}
              onExport={exportConversation}
            />
          )}
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="border-b border-border/40 px-4 py-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8"
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            <span className="text-sm font-medium text-muted-foreground">
              {conversationId
                ? conversations.find((c) => c.id === conversationId)?.title || "Análise"
                : "Nova Análise"}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <DataMindModelSelector value={selectedModel} onChange={setSelectedModel} />
              <DataMindSandboxPanel codeLanguage={codeLanguage} onLanguageChange={setCodeLanguage} pyodideStatus={pyodide.status} onReset={pyodide.reset} onInit={pyodide.init} />
            </div>
          </div>

          <DataMindChat
            messages={messages}
            files={files}
            loading={loading}
            onSend={sendMessage}
            hasConversation={!!conversationId}
            existingFiles={files}
          />
        </div>
      </div>
    </div>
  );
};

export default DataMind;
