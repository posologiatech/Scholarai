import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ReviewTeamPanel, type Person } from "./ReviewTeamPanel";
import { ScreenQueue } from "./ScreenQueue";
import { ScreeningConflicts } from "./ScreeningConflicts";
import { getScreening, ScreeningSummary } from "./ScreeningSummary";
import { supabase } from "@/integrations/supabase/client";
import type { ReviewRecord } from "@/lib/review/protocol";
import { listMembers, type Member } from "@/lib/review/screeningApi";
import type { ReviewTypeDef } from "@/lib/review/types";
import { cn } from "@/lib/utils";

type Tab = "team" | "title_abstract" | "full_text" | "conflicts" | "summary";

interface Props {
  def: ReviewTypeDef;
  review: ReviewRecord;
  userId: string;
  locale: "pt" | "en";
  onChange: (patch: Partial<ReviewRecord>) => void;
  onDataChanged: () => void;
}

export function ScreeningStage({ def, review, userId, locale, onChange, onDataChanged }: Props) {
  const pt = locale === "pt";
  const isOwner = review.owner_id === userId;
  const [tab, setTab] = useState<Tab>("title_abstract");
  const [members, setMembers] = useState<Member[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [tick, setTick] = useState(0);
  const state = getScreening(review);

  const loadTeam = useCallback(async () => {
    setMembers(await listMembers(review.id));
    if (review.research_project_id) {
      const { data } = await supabase.from("research_project_members").select("user_id, full_name, invited_email")
        .eq("project_id", review.research_project_id).not("user_id", "is", null);
      setPeople((data ?? []).map((m) => ({ user_id: m.user_id as string, name: m.full_name || m.invited_email || "—" })));
    }
  }, [review.id, review.research_project_id]);
  useEffect(() => { loadTeam().catch(console.error); }, [loadTeam]);

  const names = useMemo(() => {
    const m = new Map(people.map((p) => [p.user_id, p.name]));
    if (!m.has(userId)) m.set(userId, pt ? "Você" : "You");
    return m;
  }, [people, userId, pt]);
  // The owner always screens; members with the reviewer role join them. Adjudicators only settle conflicts.
  const reviewerIds = useMemo(() => [review.owner_id, ...members.filter((m) => m.role === "reviewer").map((m) => m.user_id)], [review.owner_id, members]);
  const amAdjudicator = isOwner || members.some((m) => m.user_id === userId && m.role === "adjudicator");
  const amReviewer = reviewerIds.includes(userId);

  const bump = useCallback(() => { setTick((t) => t + 1); onDataChanged(); }, [onDataChanged]);

  const locked = !!review.protocol_locked_at;
  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "team", label: pt ? "Equipe" : "Team", show: true },
    { key: "title_abstract", label: pt ? "Título e resumo" : "Title/abstract", show: amReviewer },
    { key: "full_text", label: pt ? "Texto completo" : "Full text", show: amReviewer },
    { key: "conflicts", label: pt ? "Desacordos" : "Disagreements", show: amAdjudicator },
    { key: "summary", label: pt ? "Resumo e fechamento" : "Summary and closing", show: isOwner },
  ];

  if (!locked) {
    return <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{pt ? "Congele o protocolo para começar a triagem: os critérios precisam estar fixos antes de qualquer decisão." : "Lock the protocol to start screening: criteria must be fixed before any decision."}</p>;
  }

  const phaseTab = tab === "full_text" ? "full_text" : "title_abstract";
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={pt ? "Triagem" : "Screening"} className="flex flex-wrap gap-1.5">
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
            {t.label}
          </button>
        ))}
      </div>

      {!amReviewer && tab !== "team" && !amAdjudicator && (
        <p className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{pt ? "Você não foi designado como revisor desta revisão." : "You were not assigned as a reviewer on this review."}</p>
      )}

      {tab === "team" && (
        <ReviewTeamPanel reviewId={review.id} ownerId={review.owner_id} members={members} candidates={people} names={names} required={def.screening.dual}
          hasProject={!!review.research_project_id} canEdit={isOwner} locale={locale} onChanged={() => { loadTeam().catch(console.error); bump(); }} />
      )}

      {(tab === "title_abstract" || tab === "full_text") && amReviewer && (
        tab === "full_text" && !state.ta_closed_at
          ? <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{pt ? "O texto completo começa quando o dono fechar a fase de título e resumo." : "Full text opens when the owner closes the title/abstract phase."}</p>
          : <ScreenQueue key={phaseTab} review={review} phase={phaseTab} userId={userId} locale={locale}
              closed={phaseTab === "title_abstract" ? !!state.ta_closed_at : !!state.ft_closed_at} onProgress={() => setTick((t) => t + 1)} />
      )}

      {tab === "conflicts" && amAdjudicator && (
        <div className="space-y-6">
          {(["title_abstract", "full_text"] as const).map((p) => (p === "full_text" && !state.ta_closed_at) ? null : (
            <section key={p} className="space-y-2">
              <h3 className="text-sm font-medium">{p === "title_abstract" ? (pt ? "Título e resumo" : "Title/abstract") : (pt ? "Texto completo" : "Full text")}</h3>
              <ScreeningConflicts key={`${p}-${tick}`} review={review} phase={p} userId={userId} reviewerIds={reviewerIds} names={names} locale={locale}
                closed={p === "title_abstract" ? !!state.ta_closed_at : !!state.ft_closed_at} onChanged={bump} />
            </section>
          ))}
        </div>
      )}

      {tab === "summary" && isOwner && (
        <ScreeningSummary review={review} userId={userId} reviewerIds={reviewerIds} names={names} hasPilotGate={def.stages.find((s) => s.key === "screening")!.gate.some((g) => g.kind === "flag" && g.flag === "pilot_done")}
          dual={def.screening.dual} locale={locale} refreshKey={tick} onChange={onChange} onDataChanged={bump} />
      )}
    </div>
  );
}
