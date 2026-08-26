import { AlignLeft, ArrowUpDown, ListChecks, LucideIcon, Percent, SlidersHorizontal, Table2 } from "lucide-react";
import { QuestionType } from "@/hooks/useSurveyStore";

export interface QuestionTypeMeta {
  icon: LucideIcon;
  /** Left-edge accent + badge classes, shared by the type gallery and the question card. */
  border: string;
  badgeBg: string;
  badgeText: string;
}

// One accent per type so a question's kind reads at a glance while scanning a long block —
// the same mapping drives the type-picker gallery and the question card's badge/left edge.
export const QUESTION_TYPE_META: Record<QuestionType, QuestionTypeMeta> = {
  multiple_choice: {
    icon: ListChecks,
    border: "border-l-blue-500",
    badgeBg: "bg-blue-500/10",
    badgeText: "text-blue-600 dark:text-blue-400",
  },
  text_entry: {
    icon: AlignLeft,
    border: "border-l-violet-500",
    badgeBg: "bg-violet-500/10",
    badgeText: "text-violet-600 dark:text-violet-400",
  },
  matrix_table: {
    icon: Table2,
    border: "border-l-amber-500",
    badgeBg: "bg-amber-500/10",
    badgeText: "text-amber-600 dark:text-amber-400",
  },
  slider: {
    icon: SlidersHorizontal,
    border: "border-l-emerald-500",
    badgeBg: "bg-emerald-500/10",
    badgeText: "text-emerald-600 dark:text-emerald-400",
  },
  rank_order: {
    icon: ArrowUpDown,
    border: "border-l-rose-500",
    badgeBg: "bg-rose-500/10",
    badgeText: "text-rose-600 dark:text-rose-400",
  },
  constant_sum: {
    icon: Percent,
    border: "border-l-cyan-500",
    badgeBg: "bg-cyan-500/10",
    badgeText: "text-cyan-600 dark:text-cyan-400",
  },
};
