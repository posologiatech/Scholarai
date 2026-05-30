import type { ResearchScheduleStatus } from "./types";

export interface AutoProgressItem {
  status: ResearchScheduleStatus;
  start_date?: string | null;
  end_date?: string | null;
}

export interface LinkedTaskLike {
  status: string; // research_tasks status: backlog | doing | review | done
}

/**
 * Hybrid automatic progress for a schedule item.
 * 1. If there are linked tasks -> percentage of tasks done (review counts as half).
 * 2. Otherwise -> derived from status + elapsed time between start/end dates.
 */
export function computeAutoProgress(item: AutoProgressItem, linkedTasks?: LinkedTaskLike[]): number {
  if (linkedTasks && linkedTasks.length > 0) {
    const weight = linkedTasks.reduce((acc, t) => {
      if (t.status === "done") return acc + 1;
      if (t.status === "review") return acc + 0.5;
      return acc;
    }, 0);
    return Math.round((weight / linkedTasks.length) * 100);
  }

  if (item.status === "concluido") return 100;
  if (item.status === "planejado") return 0;

  // em_andamento or atrasado -> time based estimate
  if (item.start_date && item.end_date) {
    const start = new Date(item.start_date).getTime();
    const end = new Date(item.end_date).getTime();
    const now = Date.now();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      if (now <= start) return 5;
      if (now >= end) return item.status === "atrasado" ? 90 : 95;
      const pct = Math.round(((now - start) / (end - start)) * 100);
      return Math.min(95, Math.max(5, pct));
    }
  }
  return 50;
}

export function progressSource(
  mode: string | undefined,
  hasLinkedTasks: boolean,
  locale: "pt" | "en",
): string {
  if (mode === "manual") return locale === "pt" ? "Manual" : "Manual";
  if (hasLinkedTasks) return locale === "pt" ? "Auto · tarefas" : "Auto · tasks";
  return locale === "pt" ? "Auto · status/tempo" : "Auto · status/time";
}
