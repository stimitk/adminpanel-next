"use client";
import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { api, asId, errorText, rowsOf } from "../lib/api";
import { plainRichText, sanitizeRichText } from "../lib/rich-text";
import type { Field, Row } from "../lib/types";
import { RichTextEditor } from "./rich-text-editor";
import { ImageAttachment } from "./image-attachment";

export function QuestionComposer({
  fields,
  initial = {},
  onSubmit,
  submitLabel = "Save question",
  successMessage = "Question saved successfully.",
  secondaryAction,
  disabled = false,
}: {
  fields: Field[];
  initial?: Row;
  onSubmit: (values: Row) => Promise<void>;
  submitLabel?: string;
  successMessage?: string;
  secondaryAction?: ReactNode;
  disabled?: boolean;
}) {
  const formId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [blocked, setBlocked] = useState<Record<string, boolean>>({});
  const [correct, setCorrect] = useState(String(initial.correctAnswer || ""));
  const has = (name: string) => fields.some((field) => field.name === name);
  const chooseSet = has("labelId");
  const [labels, setLabels] = useState<Row[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(chooseSet);
  const [labelsError, setLabelsError] = useState("");
  const [labelsRevision, setLabelsRevision] = useState(0);
  useEffect(() => {
    if (!chooseSet) return;
    const controller = new AbortController();
    setLabelsLoading(true);
    setLabelsError("");
    api("/questions/labels", { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setLabels(rowsOf(data));
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLabelsError(errorText(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLabelsLoading(false);
      });
    return () => controller.abort();
  }, [chooseSet, labelsRevision]);
  const locked = busy || disabled;
  const imagesPending = Object.values(blocked).some(Boolean);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || imagesPending) return;
    setError("");
    setSuccess("");
    const data = new FormData(event.currentTarget);
    const values: Row = {};
    for (const field of fields) {
      const raw = String(data.get(field.name) || "").trim();
      if (field.name === "questionImage" || /^option[1-4]Img$/.test(field.name))
        values[field.name] = raw;
      else if (raw)
        values[field.name] =
          field.name === "labelId"
            ? asId(raw)
            : field.type === "number"
              ? Number(raw)
              : raw;
    }
    if (!plainRichText(values.questionText)) {
      setError("Write a question before saving.");
      document.getElementById(`${formId}-question`)?.focus();
      return;
    }
    values.questionText = sanitizeRichText(String(values.questionText));
    if (!["1", "2", "3", "4"].includes(String(values.correctAnswer))) {
      setError("Select the correct answer.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(values);
      setSuccess(successMessage);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="question-composer" aria-busy={busy}>
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="notice notice-success" role="status">
          {success}
        </div>
      )}
      <fieldset disabled={locked}>
        {chooseSet && (
          <div className="field composer-set">
            <label htmlFor={`${formId}-set`}>Question set</label>
            <select
              id={`${formId}-set`}
              name="labelId"
              required
              defaultValue={String(initial.labelId || "")}
              key={labelsLoading ? "loading" : "ready"}
              disabled={locked || labelsLoading}
            >
              <option value="">
                {labelsLoading
                  ? "Loading question sets…"
                  : "Choose a question set"}
              </option>
              {labels.map((row) => (
                <option key={String(row.label_id)} value={String(row.label_id)}>
                  {String(row.label_name)}
                </option>
              ))}
            </select>
            {labelsError && (
              <p role="alert" className="attachment-error">
                {labelsError}{" "}
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setLabelsRevision((v) => v + 1)}
                >
                  Retry
                </button>
              </p>
            )}
            {!labelsLoading && !labelsError && !labels.length && (
              <p className="muted">
                Create a question set before adding questions.
              </p>
            )}
          </div>
        )}
        <section
          className="composer-section"
          aria-labelledby={`${formId}-question-title`}
        >
          <div className="composer-section-heading">
            <h3 id={`${formId}-question-title`}>Question</h3>
            <span>Required</span>
          </div>
          <RichTextEditor
            id={`${formId}-question`}
            name="questionText"
            label="Question text"
            initial={String(initial.questionText || "")}
            disabled={locked}
            required
          />
          {has("questionImage") && (
            <ImageAttachment
              name="questionImage"
              label="Question image"
              initial={String(initial.questionImage || "")}
              disabled={locked}
              onBlocked={(value) =>
                setBlocked((previous) => ({
                  ...previous,
                  questionImage: value,
                }))
              }
            />
          )}
        </section>
        <section
          className="composer-section"
          aria-labelledby={`${formId}-answers-title`}
        >
          <div className="composer-section-heading">
            <h3 id={`${formId}-answers-title`}>Answer choices</h3>
            <span>Select one correct answer</span>
          </div>
          <div className="composer-answers">
            {[1, 2, 3, 4].map((number) => {
              const text = `option${number}Text`,
                image = `option${number}Img`;
              const letter = String.fromCharCode(64 + number);
              return (
                <div
                  className={`composer-answer ${correct === String(number) ? "is-correct" : ""}`}
                  key={number}
                >
                  <div className="composer-answer-heading">
                    <label className="correct-answer-choice">
                      <input
                        type="radio"
                        name="correctAnswer"
                        value={number}
                        checked={correct === String(number)}
                        onChange={() => setCorrect(String(number))}
                        required
                      />
                      <span>Option {letter}</span>
                      <span className="correct-answer-caption">
                        {correct === String(number)
                          ? "Correct answer"
                          : "Mark correct"}
                      </span>
                    </label>
                  </div>
                  <label className="sr-only" htmlFor={`${formId}-${text}`}>
                    Option {letter} answer text
                  </label>
                  <textarea
                    id={`${formId}-${text}`}
                    name={text}
                    required
                    rows={2}
                    placeholder={`Enter answer ${letter}`}
                    defaultValue={String(initial[text] || "")}
                  />
                  {has(image) && (
                    <ImageAttachment
                      name={image}
                      label={`Option ${letter} image`}
                      initial={String(initial[image] || "")}
                      disabled={locked}
                      onBlocked={(value) =>
                        setBlocked((previous) => ({
                          ...previous,
                          [image]: value,
                        }))
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <section
          className="composer-section"
          aria-labelledby={`${formId}-settings-title`}
        >
          <h3 id={`${formId}-settings-title`}>Scoring & time</h3>
          <div className="composer-settings">
            {has("expectedTimeSeconds") && (
              <div className="field">
                <label htmlFor={`${formId}-time`}>
                  Expected time <span>(seconds)</span>
                </label>
                <input
                  id={`${formId}-time`}
                  name="expectedTimeSeconds"
                  type="number"
                  min={5}
                  max={300}
                  defaultValue={String(initial.expectedTimeSeconds || 20)}
                  required
                />
              </div>
            )}
            <div className="field">
              <label htmlFor={`${formId}-coins`}>Coins</label>
              <input
                id={`${formId}-coins`}
                name="totalCoins"
                type="number"
                min={1}
                defaultValue={String(initial.totalCoins || 10)}
                required
              />
            </div>
          </div>
        </section>
      </fieldset>
      {imagesPending && (
        <p className="muted" role="status">
          Finish uploading or remove the image with an error before saving.
        </p>
      )}
      <div className="form-actions composer-actions">
        <button
          type="submit"
          disabled={
            locked ||
            imagesPending ||
            labelsLoading ||
            !!labelsError ||
            (chooseSet && !labels.length)
          }
        >
          {busy ? "Saving question…" : submitLabel}
        </button>
        {secondaryAction ?? (
          <Link className="button secondary" href="/questions">
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
