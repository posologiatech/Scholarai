import { useRef, useEffect } from "react";
import { Message, DataMindFile, SpreadsheetData, SelectedContext } from "@/pages/DataMind";
import DataMindMessage from "./DataMindMessage";
import DataMindInput from "./DataMindInput";
import DataMindFilePreview from "./DataMindFilePreview";
import DataMindSpreadsheet from "./DataMindSpreadsheet";
import DataMindSuggestions from "./DataMindSuggestions";
import { BrainCircuit, Upload, BarChart3, Table } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  messages: Message[];
  files: DataMindFile[];
  loading: boolean;
  onSend: (content: string, file?: File) => void;
  hasConversation: boolean;
  existingFiles?: DataMindFile[];
  spreadsheetData?: SpreadsheetData | null;
  selectedContext?: SelectedContext | null;
  onSelectionChange?: (ctx: SelectedContext | null) => void;
}

const DataMindChat = ({ messages, files, loading, onSend, hasConversation, existingFiles, spreadsheetData, selectedContext, onSelectionChange }: Props) => {
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
            {/* Interactive spreadsheet or fallback file preview */}
            {files.map((f) =>
              spreadsheetData && spreadsheetData.columns.length > 0 ? (
                <DataMindSpreadsheet
                  key={f.id}
                  fileName={f.file_name}
                  data={spreadsheetData.rows}
                  columns={spreadsheetData.columns}
                  onSelectionChange={onSelectionChange}
                />
              ) : (
                <DataMindFilePreview key={f.id} file={f} />
              )
            )}

            {/* Suggestions after file upload, before first assistant message */}
            {files.length > 0 && messages.filter(m => m.role === "assistant").length === 0 && (
              <DataMindSuggestions files={files} messages={[]} onSelect={(q) => onSend(q)} loading={loading} />
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <DataMindMessage key={msg.id} message={msg} />
            ))}

            {/* Suggestions after last AI message — contextual */}
            {!loading && files.length > 0 && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
              <DataMindSuggestions files={files} messages={messages} onSelect={(q) => onSend(q)} loading={loading} />
            )}

            {loading && (
              <div className="flex items-start gap-3 py-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <BrainCircuit className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  Analisando seus dados...
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
      />
    </div>
  );
};

export default DataMindChat;
