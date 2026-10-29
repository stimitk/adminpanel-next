import { plainRichText, sanitizeRichText } from "./rich-text";
import { asId } from "./api";
import type { Row } from "./types";
export const csvTemplate =
  'labelId,questionText,option1Text,option2Text,option3Text,option4Text,correctAnswer,expectedTimeSeconds,totalCoins\n,"Which gas is released during photosynthesis?",Oxygen,Carbon Dioxide,Nitrogen,Hydrogen,1,20,10\n';
// CSV parser supports quoted commas, escaped quotes, CRLF and multiline fields.
export function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += ch;
    } else if (ch === '"') {
      if (field || closed)
        throw new Error("Invalid CSV quote. Use the downloadable template.");
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      closed = false;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      field = "";
      closed = false;
    } else {
      if (closed && ch.trim())
        throw new Error("Unexpected text after a quoted CSV field.");
      if (!closed) field += ch;
    }
  }
  if (quoted) throw new Error("A CSV quote was not closed.");
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  if (rows.length < 2)
    throw new Error("Add a header and at least one question.");
  const headers = rows.shift()!.map((v) => v.trim());
  if (new Set(headers).size !== headers.length || headers.some((v) => !v))
    throw new Error("CSV column names must be present and unique.");
  return rows.map((values, index) => {
    if (values.length !== headers.length)
      throw new Error(
        `Row ${index + 2} has ${values.length} fields; expected ${headers.length}.`,
      );
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
}
export function validateQuestions(rows: Row[], fallbackLabel: string): Row[] {
  if (!rows.length || rows.length > 1000)
    throw new Error("Import between 1 and 1,000 questions at a time.");
  return rows.map((raw, i) => {
    const result: Row = {};
    for (const key of [
      "questionText",
      "option1Text",
      "option2Text",
      "option3Text",
      "option4Text",
      "correctAnswer",
    ]) {
      const value = String(raw[key] ?? "").trim();
      if (!value) throw new Error(`Question ${i + 1}: ${key} is required.`);
      if (key === "questionText") {
        if (!plainRichText(value))
          throw new Error(`Question ${i + 1}: questionText is required.`);
        result[key] = sanitizeRichText(value);
      } else result[key] = value;
    }
    if (!["1", "2", "3", "4"].includes(String(result.correctAnswer)))
      throw new Error(
        `Question ${i + 1}: correctAnswer must be 1, 2, 3, or 4.`,
      );
    const label = String(raw.labelId || fallbackLabel).trim();
    if (!label)
      throw new Error(
        `Question ${i + 1}: select a question set or provide labelId.`,
      );
    result.labelId = asId(label);
    for (const [key, min, max, defaultValue] of [
      ["expectedTimeSeconds", 5, 300, 20],
      ["totalCoins", 1, Number.MAX_SAFE_INTEGER, 10],
    ] as const) {
      const value = Number(raw[key] || defaultValue);
      if (!Number.isSafeInteger(value) || value < min || value > max)
        throw new Error(
          `Question ${i + 1}: ${key} must be an integer between ${min} and ${max}.`,
        );
      result[key] = value;
    }
    for (const key of [
      "questionImage",
      "option1Img",
      "option2Img",
      "option3Img",
      "option4Img",
    ]) {
      if (raw[key]) {
        const value = String(raw[key]).trim();
        try {
          const url = new URL(value);
          if (!["http:", "https:"].includes(url.protocol)) throw new Error();
        } catch {
          throw new Error(`Question ${i + 1}: ${key} must be an HTTP(S) URL.`);
        }
        result[key] = value;
      }
    }
    return result;
  });
}
