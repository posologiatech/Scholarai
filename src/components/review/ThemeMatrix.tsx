import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { studyLabel, type StudyRow, type Theme } from "@/lib/review/artifacts";

interface Props {
  studies: StudyRow[];
  findings: Map<string, string>;
  themes: Theme[];
  assign: Record<string, string[]>;
  locale: "pt" | "en";
  canEdit: boolean;
  onChange: (themes: Theme[], assign: Record<string, string[]>) => void;
}

export function ThemeMatrix({ studies, findings, themes, assign, locale, canEdit, onChange }: Props) {
  const pt = locale === "pt";
  const [name, setName] = useState("");

  const add = () => {
    const n = name.trim();
    if (!n) return;
    onChange([...themes, { id: `t${Date.now().toString(36)}`, name: n }], assign);
    setName("");
  };
  const remove = (id: string) => onChange(themes.filter((t) => t.id !== id), Object.fromEntries(Object.entries(assign).map(([k, v]) => [k, v.filter((x) => x !== id)])));
  const toggle = (studyId: string, themeId: string, on: boolean) => {
    const cur = assign[studyId] ?? [];
    onChange(themes, { ...assign, [studyId]: on ? [...new Set([...cur, themeId])] : cur.filter((x) => x !== themeId) });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{pt ? "Agrupe os achados em temas e marque em quais estudos cada tema aparece. Os temas são decisão sua: reveja os achados extraídos de cada estudo na tabela." : "Group the findings into themes and mark which studies each theme appears in. Themes are your decision: review each study's extracted findings in the table."}</p>
      {canEdit && (
        <div className="flex gap-2">
          <Input aria-label={pt ? "Novo tema" : "New theme"} placeholder={pt ? "Nome do tema (ex.: Segurança)" : "Theme name (e.g. Safety)"} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} className="min-w-0" />
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={add}><Plus className="h-3.5 w-3.5" />{pt ? "Adicionar tema" : "Add theme"}</Button>
        </div>
      )}
      {themes.length === 0 ? <p className="text-sm text-muted-foreground">{pt ? "Nenhum tema ainda." : "No themes yet."}</p> : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="bg-muted/50 text-left"><tr>
              <th className="px-3 py-2 font-medium">{pt ? "Estudo" : "Study"}</th>
              {themes.map((t) => <th key={t.id} className="px-3 py-2 font-medium"><span className="flex items-center gap-1">{t.name}{canEdit && <button type="button" aria-label={`${pt ? "Remover tema" : "Remove theme"} ${t.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => remove(t.id)}><Trash2 className="h-3 w-3" /></button>}</span></th>)}
              <th className="px-3 py-2 font-medium">{pt ? "Achados extraídos" : "Extracted findings"}</th>
            </tr></thead>
            <tbody>{studies.map((s) => (
              <tr key={s.id} className="border-t border-border align-top">
                <td className="px-3 py-2 font-medium">{studyLabel(s)}</td>
                {themes.map((t) => <td key={t.id} className="px-3 py-2"><Checkbox aria-label={`${studyLabel(s)} — ${t.name}`} disabled={!canEdit} checked={assign[s.id]?.includes(t.id) ?? false} onCheckedChange={(v) => toggle(s.id, t.id, v === true)} /></td>)}
                <td className="max-w-xs px-3 py-2 text-muted-foreground">{(findings.get(s.id) ?? "").slice(0, 240) || "—"}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
