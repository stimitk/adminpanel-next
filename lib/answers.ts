// Correct answers are stored in the existing `correctAnswer` string field.
// A single answer stays "2" (backwards compatible); several are joined as "1,3".
export function parseCorrectAnswers(value: unknown): string[] {
  const parts = String(value ?? "")
    .split(/[\s,;|]+/)
    .filter(Boolean);
  if (!parts.length || parts.some((part) => !/^[1-4]$/.test(part))) return [];
  return [...new Set(parts)].sort();
}
export function formatCorrectAnswers(answers: string[]): string {
  return [...new Set(answers)].sort().join(",");
}
export function correctAnswerLabel(value: unknown): string {
  const answers = parseCorrectAnswers(value);
  return answers.length ? answers.join(", ") : String(value ?? "");
}
