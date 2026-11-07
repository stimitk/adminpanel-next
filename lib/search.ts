import { codeNumber, questionCode, questionSetCode, teacherCode } from "./codes";
import { plainRichText } from "./rich-text";
import type { Row } from "./types";

// Every word of the query must appear somewhere in the text, in any order,
// so "science basic" finds "Basics of Science".
export function matchesSearch(text: unknown, query: string): boolean {
  const haystack = String(text ?? "").toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

// Where a keyword search looks. IDs match exactly ("QS-0012", "qs12" or "12"),
// or by the start of the code while typing, so duplicate names can be told apart.
export const RECORD_SEARCH_FIELDS = [
  ["all", "All fields"],
  ["set", "Set name"],
  ["setId", "Set ID"],
  ["teacher", "Championship Maker name"],
  ["teacherId", "Championship Maker ID"],
] as const;
export type RecordSearchField =
  | (typeof RECORD_SEARCH_FIELDS)[number][0]
  | "bank"
  | "question"
  | "questionId";

function idMatches(id: unknown, code: string, query: string, prefix: string) {
  const number = codeNumber(query, prefix);
  const q = query.trim().toLowerCase();
  return (
    (number !== null && id !== null && id !== undefined && String(id) === number) ||
    // Partial codes need a digit ("QS-00"), so a lone "q" does not match every ID.
    (/\d/.test(q) && code.toLowerCase().startsWith(q))
  );
}

export function matchesRecord(row: Row, query: string, field: RecordSearchField = "all") {
  if (!query.trim()) return true;
  const teacher = { teacher_id: row.teacher_id, teacher_code: row.teacher_code };
  const checks: Record<Exclude<RecordSearchField, "all">, () => boolean> = {
    set: () => matchesSearch(row.label_name, query),
    setId: () => !!row.label_id && idMatches(row.label_id, questionSetCode(row), query, "QS"),
    teacher: () => matchesSearch(row.teacher_name, query),
    teacherId: () => !!row.teacher_id && idMatches(row.teacher_id, teacherCode(teacher), query, "TCH"),
    bank: () => matchesSearch(row.bank_name, query),
    question: () => matchesSearch(plainRichText(row.question_text), query),
    questionId: () => !!row.question_id && idMatches(row.question_id, questionCode(row), query, "Q"),
  };
  if (field !== "all") return checks[field]();
  // "All fields": every word must appear somewhere across the names and texts,
  // or the whole query is one of the IDs.
  return (
    matchesSearch(
      [row.label_name, row.bank_name, row.teacher_name, plainRichText(row.question_text)]
        .filter(Boolean)
        .join(" "),
      query,
    ) ||
    checks.setId() ||
    checks.teacherId() ||
    checks.questionId()
  );
}
