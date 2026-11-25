import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ChecklistPanel } from "./ChecklistPanel";
import { ExportPanel } from "./ExportPanel";
import { ManuscriptPanel } from "./ManuscriptPanel";
import { loadWritingData, type WritingData } from "@/lib/review/factsInput";
import { manuscriptFor, type WritingState } from "@/lib/review/manuscript";
import type { ReviewRecord } from "@/lib/review/protocol";
import type { ReviewTypeDef } from "@/lib/review/types";
import { cn } from "@/lib/utils";

type Tab = "manuscript" | "checklist" | "export";

interface Props {
  def: ReviewTypeDef;
  review: ReviewRecord;
  userId: string;
  locale: "pt" | "en";
  onChange: (patch: Partial<ReviewRecord>) => void;
}

export function WritingStage({ def, review, userId, locale, onChange }: Props) {
  const pt = locale === "pt";
  const isOwner = review.owner_id === userId;
  const [tab, setTab] = useState<Tab>("manuscript");
  const [data, setData] = useState<WritingData | null>(null);
  const manuscript = useMemo(() => manuscriptFor(def), [def]);
  const state = (review.stage_state?.writing as WritingState | undefined) ?? {};

  const load = useCallback(async () => { setData(await loadWritingData(def, review, userId)); }, [def, review.id, userId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Reload when the AI-use list changes so the declaration reflects what was actually used.
  useEffect(() => { if (isOwner) load().catch((e) => { console.error(e); toast.error(pt ? "Erro ao carregar os dados do manuscrito" : "Failed to load manuscript data"); }); }, [load, isOwner, pt, (state.aiDrafted ?? []).length]);

  const setState = (next: WritingState) => onChange({ stage_state: { ...review.stage_state, writing: next } });

  if (!isOwner) return <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{pt ? "O manuscrito é escrito pelo dono da revisão." : "The manuscript is written by the review owner."}</p>;
  if (!data) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const tabs: { key: Tab; label: string }[] = [{ key: "manuscript", label: pt ? "Manuscrito" : "Manuscript" }, { key: "checklist", label: pt ? "Checklist" : "Checklist" }, { key: "export", label: pt ? "Exportar" : "Export" }];
  return (
    <div className="space-y-5">
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>{t.label}</button>
        ))}
      </div>
      {tab === "manuscript" && <ManuscriptPanel review={review} data={data} manuscript={manuscript} state={state} locale={locale} onChange={setState} />}
      {tab === "checklist" && <ChecklistPanel reviewId={review.id} manuscript={manuscript} state={state} locale={locale} />}
      {tab === "export" && <ExportPanel def={def} review={review} userId={userId} data={data} manuscript={manuscript} state={state} locale={locale} onChange={setState} />}
    </div>
  );
}
