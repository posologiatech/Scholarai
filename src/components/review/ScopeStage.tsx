import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectPicker } from "@/components/research/ProjectPicker";
import { AREA_LABELS } from "@/lib/review/areas";
import type { ReviewRecord } from "@/lib/review/protocol";
import type { ReviewTypeDef } from "@/lib/review/types";

interface Props {
  def: ReviewTypeDef;
  review: ReviewRecord;
  locale: "pt" | "en";
  onChange: (patch: Partial<ReviewRecord>) => void;
  /** Integrative reviews define the problem here instead of in the protocol stage. */
  readOnly?: boolean;
}

export function ScopeStage({ def, review, locale, onChange }: Props) {
  const pt = locale === "pt";
  const problem = def.framework.fields.find((f) => f.key === "problem");
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="scope-title">{pt ? "Título de trabalho" : "Working title"}</Label>
        <Input id="scope-title" value={review.title} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="scope-area">{pt ? "Área" : "Area"}</Label>
          <Select value={review.area} onValueChange={(v) => onChange({ area: v })}>
            <SelectTrigger id="scope-area"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(AREA_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v[locale]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{pt ? "Projeto de pesquisa" : "Research project"}</Label>
          <ProjectPicker value={review.research_project_id} onChange={(id) => onChange({ research_project_id: id })} />
        </div>
      </div>
      {problem && (
        <div className="space-y-1.5">
          <Label htmlFor="scope-problem">{problem.label[locale]}</Label>
          <textarea
            id="scope-problem"
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder={problem.hint[locale]}
            value={review.framework?.problem ?? ""}
            onChange={(e) => onChange({ framework: { ...review.framework, problem: e.target.value } })}
          />
        </div>
      )}
    </div>
  );
}
