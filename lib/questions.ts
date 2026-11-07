import type { Row } from "./types";

// Questions without the flag (created before it existed) are included.
export function isIncludedInLive(row: Row): boolean {
  const value = row.include_in_live;
  return value !== false && value !== 0 && value !== "0" && value !== "false";
}

// Maps an API question row to the camelCase body accepted by POST/PUT /questions.
export function questionBody(row: Row): Row {
  return {
    labelId: row.label_id,
    questionText: row.question_text,
    questionImage: row.question_image,
    option1Text: row.option1_text,
    option2Text: row.option2_text,
    option3Text: row.option3_text,
    option4Text: row.option4_text,
    option1Img: row.option1_img,
    option2Img: row.option2_img,
    option3Img: row.option3_img,
    option4Img: row.option4_img,
    correctAnswer: row.correct_answer,
    totalCoins: row.total_coins,
    expectedTimeSeconds: row.expected_time_sec,
    includeInLive: isIncludedInLive(row),
  };
}

// Created and last-modified times; the API may send either column naming.
export function questionTimestamps(row: Row): { created: unknown; updated: unknown } {
  const created = row.created_at ?? row.createdAt ?? null;
  const updated = row.updated_at ?? row.updatedAt ?? null;
  // A record touched only at insert has no real update yet.
  const same = updated && created && new Date(String(updated)).getTime() === new Date(String(created)).getTime();
  return { created, updated: same ? null : updated };
}

// Admin moderation flag shared by questions and championships.
export function isBlocked(row: Row): boolean {
  const value = row.is_blocked;
  return value === true || value === 1 || value === "1" || value === "true";
}

// A question can be drawn into a live quiz only if included and not blocked.
export function isLiveEligible(row: Row): boolean {
  return isIncludedInLive(row) && !isBlocked(row);
}
