import type { Row } from "./types";

// Human-readable identifiers shown in tables. The API may send its own code
// (`champ_code`, `label_code`, …); otherwise one is derived from the numeric ID,
// which is unique, so the code is unique too.
function code(prefix: string, id: unknown, width: number): string {
  if (id === null || id === undefined || id === "") return "—";
  const value = String(id);
  return /^\d+$/.test(value) ? `${prefix}-${value.padStart(width, "0")}` : value;
}

export const championshipCode = (row: Row) =>
  String(row.champ_code || code("CH", row.champ_id, 5));
export const questionSetCode = (row: Row) =>
  String(row.label_code || code("QS", row.label_id, 4));
export const teacherCode = (row: Row) =>
  String(row.teacher_code || code("TCH", row.teacher_id, 4));
export const participantCode = (row: Row) =>
  String(row.user_code || code("USR", row.user_id, 5));

// "tch-7", "TCH0007" and "7" all mean teacher 7.
export function codeNumber(query: string, prefix: string): string | null {
  const match = query.trim().match(new RegExp(`^(?:${prefix}-?)?0*(\\d+)$`, "i"));
  return match ? match[1] : null;
}
