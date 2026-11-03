import type { Row } from "./types";

// One participant's play of a championship, in the shape the panel works with.
export type Attempt = {
  attempt_id: string;
  rank: number;
  champ_id: string;
  champ_name: string;
  label_id: string;
  label_name: string;
  teacher_id: string;
  teacher_name: string;
  user_id: string;
  user_name: string;
  user_email: string;
  total_questions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  marks: number;
  total_marks: number;
  accuracy: number;
  time_taken_sec: number;
  completed_at: string;
  completed: boolean;
  result: Result;
};
export type Result = "Passed" | "Failed" | "Incomplete";

// Share of total marks needed to pass a completed attempt.
export const PASS_PERCENT = 40;

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// "00:02:40" or seconds → seconds.
export function parseDuration(value: unknown): number {
  if (typeof value === "number") return value;
  const parts = String(value ?? "").split(":").map(Number);
  if (!parts.length || parts.some((p) => !Number.isFinite(p))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}
export function formatDuration(seconds: unknown): string {
  const total = Math.max(0, Math.round(num(seconds)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}h ${m}m ${s}s` : m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}
export function formatDateTime(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export const percent = (value: number, digits = 1) =>
  `${(Math.round(value * 10 ** digits) / 10 ** digits).toFixed(digits)}%`;

export function resultOf(row: {
  completed: boolean;
  marks: number;
  total_marks: number;
}): Result {
  if (!row.completed) return "Incomplete";
  return row.total_marks && (row.marks / row.total_marks) * 100 >= PASS_PERCENT
    ? "Passed"
    : "Failed";
}

// Accepts the detailed attempt rows and the older leaderboard/participants
// shapes (`userName`, `score`, `correctCount`, `time_taken`, …).
export function normalizeAttempt(row: Row, index = 0): Attempt {
  const total = num(row.total_questions ?? row.totalQuestions);
  const correct = num(row.correct ?? row.correct_questions ?? row.correctCount);
  const attempted = num(row.attempted ?? row.attemptedCount ?? total);
  const incorrect = num(
    row.incorrect ?? row.incorrectCount ?? Math.max(0, attempted - correct),
  );
  const marks = num(row.marks ?? row.total_score ?? row.score);
  const totalMarks = num(row.total_marks ?? row.totalMarks ?? total * 10);
  const completed =
    row.completed === undefined ? attempted >= total : Boolean(row.completed);
  const base = {
    attempt_id: String(row.attempt_id ?? row.attemptId ?? row.user_id ?? index + 1),
    rank: num(row.rank),
    champ_id: String(row.champ_id ?? ""),
    champ_name: String(row.champ_name ?? ""),
    label_id: String(row.label_id ?? ""),
    label_name: String(row.label_name ?? ""),
    teacher_id: String(row.teacher_id ?? ""),
    teacher_name: String(row.teacher_name ?? ""),
    user_id: String(row.user_id ?? row.userId ?? ""),
    user_name: String(row.user_name ?? row.userName ?? "Participant"),
    user_email: String(row.user_email ?? row.email ?? ""),
    total_questions: total,
    attempted,
    correct,
    incorrect,
    unattempted: Math.max(0, total - attempted),
    marks,
    total_marks: totalMarks,
    accuracy: attempted ? (correct / attempted) * 100 : 0,
    time_taken_sec: parseDuration(row.time_taken_sec ?? row.time_taken ?? row.timeTaken),
    completed_at: String(row.completed_at ?? row.completedAt ?? ""),
    completed,
  };
  return { ...base, result: resultOf(base) };
}

// Higher marks first, then higher accuracy, then the faster time.
export function compareAttempts(a: Attempt, b: Attempt): number {
  return (
    b.marks - a.marks ||
    b.accuracy - a.accuracy ||
    a.time_taken_sec - b.time_taken_sec
  );
}
// Competition ranking: a full tie on all three shares a rank (1, 2, 2, 4).
export function rankAttempts(rows: Attempt[]): Attempt[] {
  const sorted = [...rows].sort(compareAttempts);
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || compareAttempts(sorted[i - 1], row) !== 0) rank = i + 1;
    return { ...row, rank };
  });
}

// Performance rows are per championship × question set. Totals are weighted
// by participants so small groups do not skew the averages.
export type PerformanceRow = Row & {
  participants: number;
  total_questions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  avg_score: number;
  total_marks: number;
  avg_time_sec: number;
  completion_rate: number;
};
export function summarize(rows: Row[]) {
  const participants = rows.reduce((t, r) => t + num(r.participants), 0);
  const sum = (key: string) => rows.reduce((t, r) => t + num(r[key]), 0);
  const weighted = (key: string) =>
    participants
      ? rows.reduce((t, r) => t + num(r[key]) * num(r.participants), 0) / participants
      : 0;
  const attempted = sum("attempted");
  const correct = sum("correct");
  return {
    participants,
    attempted,
    correct,
    incorrect: sum("incorrect"),
    accuracy: attempted ? (correct / attempted) * 100 : 0,
    avgScore: weighted("avg_score"),
    avgScorePercent: participants
      ? (rows.reduce((t, r) => t + num(r.avg_score) * num(r.participants), 0) /
          Math.max(1, rows.reduce((t, r) => t + num(r.total_marks) * num(r.participants), 0))) *
        100
      : 0,
    avgTime: weighted("avg_time_sec"),
    completionRate: weighted("completion_rate"),
  };
}
