import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Switch } from "@/components/ui/switch";
import { ChevronRight, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface ColumnDef {
  name: string;
  description?: string;
  enabled: boolean;
  isCustom?: boolean;
}

interface ColumnsPanelProps {
  suggestedColumns: ColumnDef[];
  onColumnsChange: (columns: ColumnDef[]) => void;
}

const ColumnsPanel = ({ suggestedColumns, onColumnsChange }: ColumnsPanelProps) => {
  const { locale } = useLanguage();
  const [activeTab, setActiveTab] = useState<"columns">("columns");
  const [newColumnName, setNewColumnName] = useState("");

  const customColumns = suggestedColumns.filter((c) => c.isCustom);
  const suggested = suggestedColumns.filter((c) => !c.isCustom);

  const toggleColumn = (name: string) => {
    const updated = suggestedColumns.map((c) =>
      c.name === name ? { ...c, enabled: !c.enabled } : c
    );
    onColumnsChange(updated);
  };

  const addCustomColumn = () => {
    if (!newColumnName.trim()) return;
    const updated = [
      ...suggestedColumns,
      { name: newColumnName.trim(), enabled: true, isCustom: true },
    ];
    onColumnsChange(updated);
    setNewColumnName("");
  };

  return (
    <div className="flex h-full w-72 flex-col border-l border-border bg-card">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          className="flex-1 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {locale === "pt" ? "Chat com papers" : "Chat with papers"}
        </button>
        <button
          className="flex-1 border-b-2 border-primary px-4 py-3 text-sm font-medium text-primary"
        >
          {locale === "pt" ? "Editar colunas" : "Edit columns"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Custom columns */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            {locale === "pt" ? "Colunas customizadas" : "Custom columns"}
          </h4>
          {customColumns.map((col) => (
            <div key={col.name} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{col.name}</span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={col.enabled}
                  onCheckedChange={() => toggleColumn(col.name)}
                />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomColumn()}
              placeholder={locale === "pt" ? "+ Adicionar nova..." : "+ Add new..."}
              className="text-sm"
            />
          </div>
        </div>

        {/* Suggested columns */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            {locale === "pt" ? "Colunas sugeridas" : "Suggested columns"}
          </h4>
          {suggested.map((col) => (
            <div key={col.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">{col.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={col.enabled}
                  onCheckedChange={() => toggleColumn(col.name)}
                />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColumnsPanel;
