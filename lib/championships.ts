import { rowsOf } from "./api";
import { isBlocked } from "./questions";
import type { Row } from "./types";

function count(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

// `total_questions` counts every question in the championship's sets;
// `eligible_questions` only those that may be shown (included, not blocked).
// A game shows its configured number, capped by what is eligible.
export function championshipQuestionCounts(row: Row) {
  const total = count(row.total_questions);
  const eligible = count(row.eligible_questions) ?? total;
  const perGame =
    count(row.no_of_question) ??
    rowsOf(row.modes).reduce<number | null>((largest, mode) => {
      const value = count(mode.no_of_question);
      return value === null ? largest : Math.max(largest ?? 0, value);
    }, null);
  const display =
    perGame === null ? null : eligible === null ? perGame : Math.min(perGame, eligible);
  return { total, eligible, perGame, display };
}

// Question sets a championship draws from (championship-level and per game mode).
export function championshipLabelIds(row: Row): string[] {
  return [
    ...new Set([
      ...((Array.isArray(row.label_ids) ? row.label_ids : []) as unknown[]).map(String),
      ...rowsOf(row.modes).flatMap((m) => ((m.label_ids || m.labelIds || []) as unknown[]).map(String)),
    ]),
  ];
}

export type ChampionshipPhase = "Live" | "Scheduled" | "Ended" | "Inactive" | "Blocked";
// Live: active, not blocked and today is within its dates.
export function championshipPhase(row: Row, today = new Date().toISOString().slice(0, 10)): ChampionshipPhase {
  if (isBlocked(row)) return "Blocked";
  if (Number(row.status) !== 1) return "Inactive";
  const start = String(row.start_date || "").slice(0, 10);
  const end = String(row.end_date || "").slice(0, 10);
  if (end && end < today) return "Ended";
  if (start && start > today) return "Scheduled";
  return "Live";
}
