import { rowsOf } from "./api";
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
