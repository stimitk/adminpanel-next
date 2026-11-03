import { api, rowsOf } from "../lib/api";
import { championshipCode, codeNumber, questionSetCode, teacherCode } from "../lib/codes";
import { matchesSearch } from "../lib/search";
import type { Row } from "../lib/types";
import type { PickerOption } from "./ui";

const LIMIT = 10;

// Servers that ignore `search`/`limit` return everything; filter and cap here too.
function narrow(rows: Row[], query: string, matches: (row: Row) => boolean) {
  return (query ? rows.filter(matches) : rows).slice(0, LIMIT);
}

export async function loadTeachers(query: string, signal: AbortSignal): Promise<PickerOption[]> {
  const params = new URLSearchParams({ limit: String(LIMIT), ...(query ? { search: query } : {}) });
  const rows = rowsOf(await api(`/admin/teachers?${params}`, { signal }));
  const id = codeNumber(query, "TCH");
  return narrow(rows, query, (t) =>
    matchesSearch(t.teacher_name, query) || (id !== null && String(t.teacher_id).includes(id)),
  ).map((t) => ({
    value: String(t.teacher_id),
    label: String(t.teacher_name || "Unnamed teacher"),
    detail: [teacherCode(t), t.institute].filter(Boolean).join(" · "),
  }));
}

export async function loadQuestionSets(query: string, signal: AbortSignal): Promise<PickerOption[]> {
  const params = new URLSearchParams({ limit: String(LIMIT), ...(query ? { search: query } : {}) });
  const rows = rowsOf(await api(`/questions/labels?${params}`, { signal }));
  return narrow(rows, query, (l) => matchesSearch(`${l.label_name} ${l.bank_name ?? ""}`, query)).map((l) => ({
    value: String(l.label_id),
    label: String(l.label_name || "Untitled set"),
    detail: [questionSetCode(l), l.teacher_name && `${l.teacher_name} (${teacherCode(l)})`]
      .filter(Boolean)
      .join(" · "),
  }));
}

export function championshipOption(c: Row): PickerOption {
  return {
    value: String(c.champ_id),
    label: String(c.champ_name || "Untitled championship"),
    detail: [championshipCode(c), c.category_name].filter(Boolean).join(" · "),
  };
}
