import { useState } from "react";
import { ChevronRight, RotateCcw, Settings, Terminal, Code2, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  codeLanguage: string;
  onLanguageChange: (lang: string) => void;
}

const DataMindSandboxPanel = ({ codeLanguage, onLanguageChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [subMenu, setSubMenu] = useState<string | null>(null);

  const languages = [
    { id: "python", label: "Python", icon: "🐍" },
    { id: "r", label: "R", icon: "📊" },
  ];

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSubMenu(null); }}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50">
          <Terminal className="h-3.5 w-3.5" />
          <span>Sandbox</span>
          <span className="text-emerald-500 text-[10px] font-medium">Connected</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" sideOffset={4}>
        {subMenu === null && (
          <div>
            {/* Sandbox status */}
            <div className="px-3 py-2.5 border-b border-border/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground">Sandbox</span>
                <span className="text-xs font-medium text-emerald-500">Healthy</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>RAM</span>
                  <span className="font-mono">0.3/2GB</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>CPU</span>
                  <span className="font-mono">0%</span>
                </div>
              </div>
            </div>

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
            <button className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors border-t border-border/40">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Reset...</span>
            </button>

            {/* Settings */}
            <button className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Sandbox Settings</span>
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
                <span className="text-sm text-foreground">{lang.label}</span>
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
