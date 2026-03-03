import { useState } from "react";
import { ChevronRight, RotateCcw, Terminal, Code2, Check, Play } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PyodideStatus } from "@/hooks/usePyodide";
import { WebRStatus } from "@/hooks/useWebR";

interface Props {
  codeLanguage: string;
  onLanguageChange: (lang: string) => void;
  pyodideStatus: PyodideStatus;
  onReset: () => void;
  onInit: () => void;
  webRStatus?: WebRStatus;
  onWebRInit?: () => void;
  onWebRReset?: () => void;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  idle: { label: "Offline", color: "text-muted-foreground" },
  loading: { label: "Carregando...", color: "text-amber-500" },
  installing: { label: "Instalando pacotes...", color: "text-amber-500" },
  ready: { label: "Pronto", color: "text-emerald-500" },
  running: { label: "Executando...", color: "text-blue-500" },
  error: { label: "Erro", color: "text-destructive" },
};

const DataMindSandboxPanel = ({ codeLanguage, onLanguageChange, pyodideStatus, onReset, onInit, webRStatus, onWebRInit, onWebRReset }: Props) => {
  const [open, setOpen] = useState(false);
  const [subMenu, setSubMenu] = useState<string | null>(null);

  const isPython = codeLanguage === "python";
  const activeStatus = isPython ? pyodideStatus : (webRStatus || "idle");
  const statusInfo = statusLabels[activeStatus] || statusLabels.idle;

  const languages = [
    { id: "python", label: "Python", icon: "🐍", status: statusLabels[pyodideStatus]?.label || "Offline" },
    { id: "r", label: "R (WebR)", icon: "📊", status: statusLabels[webRStatus || "idle"]?.label || "Offline" },
  ];

  const handleInit = () => {
    if (isPython) onInit();
    else onWebRInit?.();
    setOpen(false);
  };

  const handleReset = () => {
    if (isPython) onReset();
    else onWebRReset?.();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSubMenu(null); }}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50">
          <Terminal className="h-3.5 w-3.5" />
          <span>Sandbox</span>
          <span className={`text-[10px] font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" sideOffset={4}>
        {subMenu === null && (
          <div>
            {/* Sandbox status */}
            <div className="px-3 py-2.5 border-b border-border/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground">
                  {isPython ? "Pyodide (Python)" : "WebR (R)"} · Browser
                </span>
                <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isPython
                  ? "Python roda no seu navegador — sem custo de servidor."
                  : "R roda no seu navegador via WebAssembly."}
              </p>
            </div>

            {/* Init button when idle */}
            {activeStatus === "idle" && (
              <button
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/40"
                onClick={handleInit}
              >
                <Play className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">Iniciar Sandbox</span>
              </button>
            )}

            {/* Code Language */}
            <button
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
              onClick={() => setSubMenu("language")}
            >
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Code Language</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground capitalize">{codeLanguage}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </button>

            {/* Reset */}
            <button
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors border-t border-border/40"
              onClick={handleReset}
              disabled={activeStatus === "idle"}
            >
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Reset Sandbox</span>
            </button>
          </div>
        )}

        {subMenu === "language" && (
          <div>
            <div className="px-3 py-2 border-b border-border/40">
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSubMenu(null)}
              >
                ← Voltar
              </button>
            </div>
            {languages.map((lang) => (
              <button
                key={lang.id}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                onClick={() => {
                  onLanguageChange(lang.id);
                  setSubMenu(null);
                  setOpen(false);
                }}
              >
                <span className="text-sm">{lang.icon}</span>
                <div className="flex-1 text-left">
                  <span className="text-sm text-foreground">{lang.label}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">{lang.status}</span>
                </div>
                {codeLanguage === lang.id && <Check className="h-4 w-4 text-primary ml-auto" />}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default DataMindSandboxPanel;
