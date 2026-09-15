import { useRef, useEffect } from "react";
import { Message, DataMindFile, SpreadsheetData, SelectedContext } from "@/pages/DataMind";
import DataMindMessage from "./DataMindMessage";
import DataMindInput from "./DataMindInput";
import DataMindFilePreview from "./DataMindFilePreview";
import DataMindSpreadsheet from "./DataMindSpreadsheet";
import DataMindSuggestions from "./DataMindSuggestions";
import DataMindFindingsPanel from "./DataMindFindingsPanel";
import DataMindBriefing from "./DataMindBriefing";
import { Finding } from "@/lib/datamind/findings";
import { BrainCircuit, Upload, BarChart3, Table, Square } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  messages: Message[];
  files: DataMindFile[];
  loading: boolean;
  /** What the assistant is doing right now, shown instead of a generic spinner. */
  loadingStage?: string | null;
  /** The explanation as it streams in, before the message row exists. */
  streamingText?: string;
  conversationId?: string;
  onSend: (content: string, attachments?: File[]) => void;
  hasConversation: boolean;
  existingFiles?: DataMindFile[];
  spreadsheetData?: SpreadsheetData | null;
  selectedContext?: SelectedContext | null;
  onSelectionChange?: (ctx: SelectedContext | null) => void;
  onOpenGoogleSheetsImport?: () => void;
  /** Automatic findings from the deterministic scan, once it has run. */
  findings?: Finding[];
  findingsScanning?: boolean;
  onDismissFinding?: (finding: Finding) => void;
  onInterpretFindings?: () => void;
  interpretingFindings?: boolean;
  triageSummary?: string;
  /** Model choice, so the written briefing uses the one the researcher picked. */
  selectedModel?: { provider: string; model: string } | null;
  /** The spreadsheet currently open in the grid, when several are attached. */
  activeFileId?: string;
  onSelectFile?: (fileId: string) => void;
  /** True while a multi-step plan is running, which can be several minutes of calls. */
  planRunning?: boolean;
  onCancelPlan?: () => void;
}

const DataMindChat = ({ messages, files, loading, loadingStage, streamingText, conversationId, onSend, hasConversation, existingFiles, spreadsheetData, selectedContext, onSelectionChange, onOpenGoogleSheetsImport, findings = [], findingsScanning = false, onDismissFinding, onInterpretFindings, interpretingFindings, triageSummary, selectedModel, activeFileId, onSelectFile, planRunning, onCancelPlan }: Props) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const showWelcome = messages.length === 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {showWelcome ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-xl"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
                <BrainCircuit className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-display font-bold text-foreground mb-2">
                O que você quer analisar hoje?
              </h1>
              <p className="text-muted-foreground mb-8">
                Envie um arquivo CSV ou Excel e faça perguntas sobre seus dados. A IA vai analisar, gerar gráficos e insights automaticamente.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                {[
                  { icon: Upload, label: "Upload de dados", desc: "CSV, Excel" },
                  { icon: BarChart3, label: "Gráficos com IA", desc: "Matplotlib, Seaborn" },
                  { icon: Table, label: "Análise tabular", desc: "Pandas, NumPy" },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="rounded-xl border border-border/60 bg-card p-4 text-left"
                  >
                    <item.icon className="h-5 w-5 text-primary mb-2" />
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-1">
            {/* The grid holds one sheet at a time — the others are previews the
                researcher can open, since `spreadsheetData` describes the active
                file alone and reusing it for every card would show one file's rows
                under another file's name. */}
            {files.map((f) => {
              const isActive = f.id === (activeFileId ?? files[0]?.id);
              if (isActive && spreadsheetData && spreadsheetData.columns.length > 0) {
                return (
                  <DataMindSpreadsheet
                    key={f.id}
                    fileName={f.file_name}
                    data={spreadsheetData.rows}
                    columns={spreadsheetData.columns}
                    totalRows={spreadsheetData.totalRows}
                    truncated={spreadsheetData.truncated}
                    onSelectionChange={onSelectionChange}
                  />
                );
              }
              return (
                <DataMindFilePreview
                  key={f.id}
                  file={f}
                  onOpen={!isActive && onSelectFile ? () => onSelectFile(f.id) : undefined}
                />
              );
            })}

            {/* What is in the file, assembled from the profile and the stored
                findings — no rescan, no AI call unless the researcher asks for
                the written version. Scoped to the active file. */}
            {files.length > 0 && (
              <DataMindBriefing
                key={(files.find((f) => f.id === activeFileId) || files[0]).id}
                file={files.find((f) => f.id === activeFileId) || files[0]}
                findings={findings}
                model={selectedModel}
                loading={loading}
                onAsk={(q) => onSend(q)}
              />
            )}

            {/* What the scan found, before the researcher has asked anything */}
            {files.length > 0 && (
              <DataMindFindingsPanel
                findings={findings}
                scanning={findingsScanning}
                loading={loading}
                onAsk={(q) => onSend(q)}
                onDismiss={(f) => onDismissFinding?.(f)}
                onInterpret={onInterpretFindings}
                interpreting={interpretingFindings}
                triageSummary={triageSummary}
              />
            )}

            {/* Suggestions after file upload, before first assistant message */}
            {files.length > 0 && messages.filter(m => m.role === "assistant").length === 0 && (
              <DataMindSuggestions files={files} messages={[]} findings={findings} onSelect={(q) => onSend(q)} loading={loading} />
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <DataMindMessage key={msg.id} message={msg} conversationId={conversationId} />
            ))}

            {/* Suggestions after last AI message — contextual */}
            {!loading && files.length > 0 && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
              <DataMindSuggestions files={files} messages={messages} findings={findings} onSelect={(q) => onSend(q)} loading={loading} />
            )}

            {loading && (
              <div className="flex items-start gap-3 py-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <BrainCircuit className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Once text starts arriving, it replaces the status line: the
                      researcher reads the plan while the code is still generating. */}
                  {streamingText ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{streamingText}</p>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      {loadingStage || "Analisando seus dados..."}
                    </div>
                  )}
                  {/* A plan chains several AI calls, so it needs a way out that
                      isn't reloading the page. The current step still finishes. */}
                  {planRunning && onCancelPlan && (
                    <button
                      type="button"
                      onClick={onCancelPlan}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    >
                      <Square className="h-3 w-3" />
                      Interromper plano
                    </button>
                  )}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <DataMindInput
        onSend={onSend}
        loading={loading}
        existingFiles={existingFiles}
        selectedContext={selectedContext}
        onClearSelection={() => onSelectionChange?.(null)}
        onOpenGoogleSheetsImport={onOpenGoogleSheetsImport}
      />
    </div>
  );
};

export default DataMindChat;
