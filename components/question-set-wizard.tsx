"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError, asId, errorText } from "../lib/api";
import { questionFields, resources } from "../lib/resources";
import type { Row } from "../lib/types";
import { BulkImport } from "./bulk-import";
import {
  DataTable,
  Form,
  Heading,
  Loading,
  Notice,
  Retry,
  useLoad,
} from "./ui";
const steps = ["Name your set", "Add questions", "Review & finish"];
export function QuestionSetWizard({
  onComplete,
  onCancel,
  embedded = false,
}: {
  onComplete: (id: string) => void;
  onCancel: () => void;
  embedded?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [method, setMethod] = useState<"manual" | "import">("manual");
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const questions = useLoad<{ questions: Row[]; total: number }>(
    id
      ? `/questions/?${new URLSearchParams({ labelId: id, page: String(page), limit: "20" })}`
      : null,
    revision,
  );
  const total = Number(questions.data?.total || 0);
  const busy = importing || adding;
  useEffect(() => {
    title.current?.focus();
  }, [step]);
  return (
    <>
      {!embedded && (
        <Heading
          title="Create Question Set"
          description="Name your set, add questions, and review everything before finishing."
        />
      )}
      <nav
        className="wizard-progress"
        aria-label="Question set creation progress"
      >
        <ol>
          {steps.map((label, index) => (
            <li
              key={label}
              className={
                index === step ? "current" : index < step ? "complete" : ""
              }
              aria-current={index === step ? "step" : undefined}
            >
              <span className="wizard-step-number" aria-hidden="true">
                {index < step ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </nav>
      <section
        className={
          embedded ? "question-set-wizard-inline" : "paper wizard-panel"
        }
        key={step}
      >
        <h2 ref={title} tabIndex={-1}>
          {steps[step]}
        </h2>
        {step === 0 &&
          (id ? (
            <>
              <p>
                Your set has been saved as <strong>{name}</strong>. Continue to
                add or import questions.
              </p>
              <div className="wizard-actions">
                <button className="secondary" onClick={onCancel}>
                  View question sets
                </button>
                <button onClick={() => setStep(1)}>
                  Continue to questions
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="muted">
                Give this collection a name that makes it easy to find when
                creating a championship.
              </p>
              {uncertain && (
                <Notice>
                  Creation could not be confirmed.{" "}
                  <Link href="/labels">Check your question sets</Link> before
                  trying again to avoid a duplicate.
                </Notice>
              )}
              <Form
                fields={resources.labels.fields!}
                initial={{ labelName: name }}
                submitLabel="Continue to questions"
                successMessage=""
                disabled={uncertain}
                secondaryAction={
                  <button
                    type="button"
                    className="secondary"
                    onClick={onCancel}
                  >
                    Cancel
                  </button>
                }
                onSubmit={async (body) => {
                  setName(String(body.labelName));
                  try {
                    const result = await api<{ labelId: string | number }>(
                      "/questions/labels",
                      { method: "POST", body },
                    );
                    if (!result.labelId) {
                      setUncertain(true);
                      throw new Error(
                        "The service did not confirm the new set. Check your question sets before retrying.",
                      );
                    }
                    setId(String(result.labelId));
                    setStep(1);
                  } catch (error) {
                    if (
                      error instanceof ApiError &&
                      (error.status === 0 ||
                        error.status >= 500 ||
                        error.status === 200)
                    )
                      setUncertain(true);
                    throw error;
                  }
                }}
              />
            </>
          ))}
        {step === 1 && (
          <>
            <p>
              Add questions to <strong>{name}</strong>, one at a time or from a
              CSV/JSON file.
            </p>
            <div
              className="set-view-switch"
              role="group"
              aria-label="How to add questions"
            >
              {(
                [
                  ["manual", "Add manually"],
                  ["import", "Bulk import"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={method === value ? "small" : "small secondary"}
                  disabled={busy}
                  aria-pressed={method === value}
                  onClick={() => setMethod(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {message && <Notice kind="success">{message}</Notice>}
            {method === "manual" ? (
              <Form
                key={revision}
                fields={questionFields.filter(
                  (field) => field.name !== "labelId",
                )}
                submitLabel="Save question & add another"
                secondaryAction={
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setMethod("import")}
                  >
                    Import instead
                  </button>
                }
                onSubmit={async (body) => {
                  setAdding(true);
                  try {
                    await api("/questions/", {
                      method: "POST",
                      body: { ...body, labelId: asId(id) },
                    });
                    setMessage("Question saved to your set.");
                    setRevision((v) => v + 1);
                  } finally {
                    setAdding(false);
                  }
                }}
              />
            ) : (
              <BulkImport
                setId={id}
                setName={name}
                embedded
                onBusyChange={setImporting}
                onImported={() => {
                  setMessage("Imported questions have been saved to your set.");
                  setRevision((v) => v + 1);
                }}
              />
            )}
            {questions.error && (
              <Retry
                error={questions.error}
                onRetry={() => setRevision((v) => v + 1)}
              />
            )}
            <p className="wizard-question-summary" role="status">
              {questions.loading
                ? "Checking your question set…"
                : `${total} ${total === 1 ? "question" : "questions"} saved`}
            </p>
            <div className="wizard-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setStep(0)}
              >
                Back to set details
              </button>
              <button
                disabled={
                  busy || questions.loading || !!questions.error || total < 1
                }
                onClick={() => setStep(2)}
              >
                Review question set
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <p>
              <strong>{name}</strong> · {total}{" "}
              {total === 1 ? "question" : "questions"}
            </p>
            {questions.loading ? (
              <Loading />
            ) : questions.error ? (
              <Retry
                error={questions.error}
                onRetry={() => setRevision((v) => v + 1)}
              />
            ) : (
              <>
                <DataTable
                  rows={questions.data?.questions || []}
                  columns={[
                    ["question_text", "Question"],
                    ["option1_text", "Option 1"],
                    ["option2_text", "Option 2"],
                    ["option3_text", "Option 3"],
                    ["option4_text", "Option 4"],
                    ["correct_answer", "Correct answer"],
                    ["total_coins", "Coins"],
                  ]}
                />
                <div className="pagination">
                  <button
                    className="secondary"
                    disabled={page === 1}
                    onClick={() => setPage((v) => v - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {Math.max(1, Math.ceil(total / 20))}
                  </span>
                  <button
                    className="secondary"
                    disabled={page * 20 >= total}
                    onClick={() => setPage((v) => v + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
            <div className="wizard-actions">
              <button className="secondary" onClick={() => setStep(1)}>
                Back to questions
              </button>
              <button
                disabled={questions.loading || !!questions.error || total < 1}
                onClick={() => onComplete(id)}
              >
                Finish question set
              </button>
            </div>
          </>
        )}
      </section>
      <p className="muted wizard-draft-note">
        Your set is saved when you continue from the first step. Questions are
        saved as you add them, so you can return to them from Question Sets.
      </p>
    </>
  );
}
