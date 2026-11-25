import { Gavel, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addMember, removeMember, setMemberRole, type Member } from "@/lib/review/screeningApi";

export interface Person { user_id: string; name: string }

interface Props {
  reviewId: string;
  ownerId: string;
  members: Member[];
  /** People on the linked research project who can be invited. */
  candidates: Person[];
  names: Map<string, string>;
  required: "required" | "recommended" | "optional";
  hasProject: boolean;
  canEdit: boolean;
  locale: "pt" | "en";
  onChanged: () => void;
}

export function ReviewTeamPanel({ reviewId, ownerId, members, candidates, names, required, hasProject, canEdit, locale, onChanged }: Props) {
  const pt = locale === "pt";
  const taken = new Set([ownerId, ...members.map((m) => m.user_id)]);
  const available = candidates.filter((c) => !taken.has(c.user_id));
  const reviewers = 1 + members.filter((m) => m.role === "reviewer").length;
  const nameOf = (id: string) => (id === ownerId ? `${names.get(id) ?? (pt ? "Você" : "You")} (${pt ? "dono" : "owner"})` : names.get(id) ?? "—");

  const run = async (fn: () => Promise<void>) => {
    try { await fn(); onChanged(); } catch (e) { console.error(e); toast.error(pt ? "Não foi possível alterar a equipe." : "Could not change the team."); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {required === "required"
          ? (pt ? "Este tipo de revisão exige dois revisores independentes. Um terceiro, o adjudicador, resolve os desacordos." : "This review type requires two independent reviewers. A third, the adjudicator, settles disagreements.")
          : (pt ? "Dois revisores independentes são recomendados. Você pode triar sozinho, e a escolha fica registrada." : "Two independent reviewers are recommended. You may screen alone, and the choice is recorded.")}
      </p>
      <ul className="space-y-2">
        <li className="flex items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
          <span className="min-w-0 truncate">{nameOf(ownerId)}</span>
          <Badge variant="secondary" className="gap-1"><UserCheck className="h-3 w-3" />{pt ? "Revisor" : "Reviewer"}</Badge>
        </li>
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
            <span className="min-w-0 truncate">{nameOf(m.user_id)}</span>
            <div className="flex items-center gap-2">
              {canEdit ? (
                <select aria-label={pt ? "Papel" : "Role"} value={m.role} className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  onChange={(e) => run(() => setMemberRole(m.id, e.target.value as Member["role"]))}>
                  <option value="reviewer">{pt ? "Revisor" : "Reviewer"}</option>
                  <option value="adjudicator">{pt ? "Adjudicador" : "Adjudicator"}</option>
                </select>
              ) : <Badge variant="outline" className="gap-1">{m.role === "adjudicator" ? <Gavel className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}{m.role}</Badge>}
              {canEdit && <button aria-label={pt ? "Remover da equipe" : "Remove from team"} className="text-muted-foreground hover:text-destructive" onClick={() => run(() => removeMember(m.id))}><X className="h-4 w-4" /></button>}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {pt ? `${reviewers} revisor(es) · ${members.some((m) => m.role === "adjudicator") ? "adjudicador designado" : "sem adjudicador: você resolverá os desacordos"}` : `${reviewers} reviewer(s) · ${members.some((m) => m.role === "adjudicator") ? "adjudicator assigned" : "no adjudicator: you will settle disagreements"}`}
      </p>

      {canEdit && (
        hasProject ? (
          available.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">{pt ? "Adicionar do projeto de pesquisa" : "Add from the research project"}</h3>
              <ul className="flex flex-wrap gap-2">{available.map((p) => (
                <li key={p.user_id}><Button size="sm" variant="outline" onClick={() => run(() => addMember(reviewId, p.user_id, "reviewer"))}>{p.name}</Button></li>
              ))}</ul>
            </div>
          ) : <p className="text-sm text-muted-foreground">{pt ? "Todos os membros do projeto já estão na equipe." : "Every project member is already on the team."}</p>
        ) : (
          <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{pt ? "Para convidar revisores, vincule esta revisão a um projeto de pesquisa na etapa Tipo e escopo. Os membros do projeto aparecem aqui." : "To invite reviewers, link this review to a research project in the Type and scope stage. Project members appear here."}</p>
        )
      )}
    </div>
  );
}
