"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError, asId, errorText, rowsOf } from "../lib/api";
import {
  championshipFields,
  questionFields,
  resources,
} from "../lib/resources";
import type { Row } from "../lib/types";
import { Form, Heading, Loading, Notice, Retry, useLoad } from "./ui";

import { BulkImport } from "./bulk-import";
import { QuestionSetWizard } from "./question-set-wizard";

const steps = ["Set up championship", "Add questions", "Review & publish"];
export function ChampionshipWizard() {
  const [step, setStep] = useState(0);
  const [setup, setSetup] = useState<Row>({
    modeName: "Quick Hit",
    noOfQuestions: 10,
    durationMinutes: 10,
    startTime: "09:00",
    endTime: "18:00",
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<"question" | "set" | "import" | null>(
    null,
  );
  const [importTarget, setImportTarget] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsLoading, setCountsLoading] = useState(false);
  const [countError, setCountError] = useState("");
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  const publishingRef = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const labels = useLoad<unknown>("/questions/labels", revision);
  const categories = useLoad<unknown>("/questions/categories");
  const selectedKey = selected.slice().sort().join(",");
  useEffect(() => {
    titleRef.current?.focus();
  }, [step, published]);
  useEffect(() => {
    if (!selectedKey) {
      setCounts({});
      setCountsLoading(false);
      setCountError("");
      return;
    }
    const controller = new AbortController();
    setCountsLoading(true);
    setCountError("");
    Promise.all(
      selectedKey.split(",").map(async (id) => {
        const result = await api<{ total: number }>(
          `/questions/?${new URLSearchParams({ labelId: id, limit: "1", page: "1" })}`,
          { signal: controller.signal },
        );
        return [id, Number(result.total)] as const;
      }),
    )
      .then((values) => {
        if (!controller.signal.aborted) setCounts(Object.fromEntries(values));
      })
      .catch((error) => {
        if (!controller.signal.aborted) setCountError(errorText(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setCountsLoading(false);
      });
    return () => controller.abort();
  }, [selectedKey, revision]);
  const sets = rowsOf(labels.data);
  const total = selected.reduce((sum, id) => sum + (counts[id] || 0), 0);
  const ready =
    selected.length > 0 &&
    !countsLoading &&
    !countError &&
    total >= Number(setup.noOfQuestions);
  const setName = (id: string) =>
    String(sets.find((row) => String(row.label_id) === id)?.label_name || id);
  async function publish() {
    if (publishingRef.current || published || uncertain || !ready) return;
    publishingRef.current = true;
    setPublishing(true);
    setPublishError("");
    try {
      const minutes = Number(setup.durationMinutes);
      const result = await api<{ champId: string | number }>(
        "/teacher/championships",
        {
          method: "POST",
          body: {
            champName: setup.champName,
            categoryId: setup.categoryId,
            startDate: setup.startDate,
            endDate: setup.endDate,
            startTime: setup.startTime,
            endTime: setup.endTime,
            modes: [
              {
                modeName: setup.modeName,
                description: setup.description || "",
                noOfQuestions: Number(setup.noOfQuestions),
                timeMinutes: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`,
                labelIds: selected.map(asId),
              },
            ],
          },
        },
      );
      if (!result.champId) {
        setUncertain(true);
        throw new Error(
          "The service did not return a championship ID. Check Championships before publishing again.",
        );
      }
      setPublished(String(result.champId));
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 0 || error.status >= 500 || error.status === 200)
      ) {
        setUncertain(true);
        setPublishError(
          "Publication could not be confirmed. Check Championships before trying again to avoid creating a duplicate.",
        );
      } else setPublishError(errorText(error));
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  }
  if (published)
    return (
      <>
        <Heading title="Championship published" />
        <section className="paper wizard-complete">
          <h2 ref={titleRef} tabIndex={-1}>
            {String(setup.champName)} is ready.
          </h2>
          <p>
            Your championship has been published with{" "}
            {String(setup.noOfQuestions)} questions per game.
          </p>
          <div className="form-actions">
            <Link
              className="button"
              href={`/championships/${encodeURIComponent(published)}`}
            >
              View championship
            </Link>
            <Link className="button secondary" href="/championships">
              All championships
            </Link>
          </div>
        </section>
      </>
    );
  return (
    <>
      <Heading
        title="Create Championship"
        description="Set it up, prepare your questions, then publish when you’re ready."
      />
      <nav
        aria-label="Championship creation progress"
        className="wizard-progress"
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
      <section className="paper wizard-panel" key={step}>
        <h2 ref={titleRef} tabIndex={-1}>
          {steps[step]}
        </h2>
        {step === 0 && (
          <>
            <p className="muted">
              Start with the championship details and game settings. Your
              progress stays here while you move between steps.
            </p>
            <Form
              fields={championshipFields.filter((f) => f.name !== "labelIds")}
              initial={setup}
              submitLabel="Continue to questions"
              successMessage=""
              onSubmit={async (values) => {
                if (
                  `${values.endDate}T${values.endTime}` <=
                  `${values.startDate}T${values.startTime}`
                )
                  throw new Error(
                    "The end date and time must be after the start.",
                  );
                setSetup(values);
                setStep(1);
              }}
            />
          </>
        )}
        {step === 1 && (
          <>
            <p>
              Choose the question sets for this championship. Each game uses{" "}
              {String(setup.noOfQuestions)} questions from the selected sets.
            </p>
            <div className="wizard-question-tools">
              <button
                type="button"
                className="secondary"
                disabled={importBusy}
                onClick={() => setEditor(editor === "set" ? null : "set")}
              >
                {editor === "set"
                  ? "Close question set form"
                  : "New question set"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={importBusy}
                onClick={() =>
                  setEditor(editor === "question" ? null : "question")
                }
              >
                {editor === "question"
                  ? "Close question form"
                  : "Add a question"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={importBusy}
                onClick={() => {
                  setImportTarget(
                    importTarget ||
                      selected[0] ||
                      String(sets[0]?.label_id || ""),
                  );
                  setEditor(editor === "import" ? null : "import");
                }}
              >
                {editor === "import" ? "Close importer" : "Import questions"}
              </button>
            </div>
            {editor && (
              <div className="wizard-inline-editor">
                {editor !== "import" && (
                  <h3>
                    {editor === "set" ? "New question set" : "Add a question"}
                  </h3>
                )}
                {editor === "import" ? (
                  <>
                    <div className="field">
                      <label htmlFor="wizard-import-set">
                        Import into question set
                      </label>
                      <select
                        id="wizard-import-set"
                        disabled={importBusy}
                        value={importTarget}
                        onChange={(event) =>
                          setImportTarget(event.target.value)
                        }
                      >
                        <option value="">Choose a question set</option>
                        {sets.map((row) => (
                          <option
                            key={String(row.label_id)}
                            value={String(row.label_id)}
                          >
                            {String(row.label_name)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {importTarget ? (
                      <BulkImport
                        key={importTarget}
                        setId={importTarget}
                        setName={setName(importTarget)}
                        embedded
                        onBusyChange={setImportBusy}
                        onImported={() => {
                          setSelected((ids) => [
                            ...new Set([...ids, importTarget]),
                          ]);
                          setRevision((v) => v + 1);
                        }}
                      />
                    ) : (
                      <Notice kind="info">
                        Create or choose a question set before importing
                        questions.
                      </Notice>
                    )}
                  </>
                ) : editor === "set" ? (
                  <QuestionSetWizard
                    embedded
                    onCancel={() => setEditor(null)}
                    onComplete={(id) => {
                      setSelected((ids) => [...new Set([...ids, id])]);
                      setImportTarget(id);
                      setRevision((v) => v + 1);
                      setEditor(null);
                    }}
                  />
                ) : (
                  <Form
                    key={`question-${revision}`}
                    fields={questionFields}
                    initial={{ labelId: selected[0] || "" }}
                    submitLabel="Add question"
                    secondaryAction={
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setEditor(null)}
                      >
                        Close editor
                      </button>
                    }
                    onSubmit={async (body) => {
                      await api("/questions/", { method: "POST", body });
                      setSelected((ids) => [
                        ...new Set([...ids, String(body.labelId)]),
                      ]);
                      setRevision((v) => v + 1);
                    }}
                  />
                )}
              </div>
            )}
            {labels.loading ? (
              <Loading />
            ) : labels.error ? (
              <Retry
                error={labels.error}
                onRetry={() => setRevision((v) => v + 1)}
              />
            ) : sets.length ? (
              <fieldset className="wizard-question-sets">
                <legend>Question sets</legend>
                {sets.map((row) => {
                  const id = String(row.label_id);
                  return (
                    <label className="wizard-set-option" key={id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(id)}
                        onChange={(event) =>
                          setSelected((ids) =>
                            event.target.checked
                              ? [...ids, id]
                              : ids.filter((value) => value !== id),
                          )
                        }
                      />
                      <span>{String(row.label_name)}</span>
                      {selected.includes(id) && (
                        <small>
                          {countsLoading
                            ? "Counting…"
                            : `${counts[id] || 0} questions`}
                        </small>
                      )}
                    </label>
                  );
                })}
              </fieldset>
            ) : (
              <Notice kind="info">
                No question sets yet. Create your first set above, then add
                questions to it.
              </Notice>
            )}
            {countError && (
              <Retry
                error={countError}
                onRetry={() => setRevision((v) => v + 1)}
              />
            )}
            <p className="wizard-question-summary" role="status">
              {countsLoading
                ? "Checking available questions…"
                : `${total} questions available · ${String(setup.noOfQuestions)} needed per game`}
            </p>
            {!ready && selected.length > 0 && !countsLoading && !countError && (
              <p className="muted">
                Add at least {Math.max(0, Number(setup.noOfQuestions) - total)}{" "}
                more questions, or select another set.
              </p>
            )}
            <div className="wizard-actions">
              <button
                className="secondary"
                disabled={importBusy}
                onClick={() => setStep(0)}
              >
                Back to setup
              </button>
              <button
                disabled={
                  !ready || labels.loading || !!labels.error || editor !== null
                }
                onClick={() => setStep(2)}
              >
                Continue to review
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <p>
              Check the details below. Publishing makes this championship active
              with the schedule you’ve chosen.
            </p>
            <dl className="details-list">
              {[
                ["Championship", setup.champName],
                [
                  "Category",
                  rowsOf(categories.data).find(
                    (row) =>
                      String(row.category_id) === String(setup.categoryId),
                  )?.category_name || setup.categoryId,
                ],
                ["Starts", `${setup.startDate} at ${setup.startTime}`],
                ["Ends", `${setup.endDate} at ${setup.endTime}`],
                ["Game mode", setup.modeName],
                ["Questions per game", setup.noOfQuestions],
                ["Duration", `${setup.durationMinutes} minutes`],
                ["Question sets", selected.map(setName).join(", ")],
                ["Available questions", countsLoading ? "Checking…" : total],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt>{String(label)}</dt>
                  <dd>{String(value || "—")}</dd>
                </div>
              ))}
            </dl>
            {publishError && (
              <Notice>
                {publishError}
                {uncertain && (
                  <>
                    {" "}
                    <Link href="/championships">Check championships</Link>
                  </>
                )}
              </Notice>
            )}
            {countError && (
              <Retry
                error={countError}
                onRetry={() => setRevision((v) => v + 1)}
              />
            )}
            <div className="wizard-actions">
              <button
                className="secondary"
                disabled={publishing || uncertain}
                onClick={() => setStep(1)}
              >
                Back to questions
              </button>
              <button
                disabled={publishing || uncertain || !ready}
                onClick={publish}
              >
                {publishing ? "Publishing…" : "Publish championship"}
              </button>
            </div>
          </>
        )}
      </section>
      <p className="muted wizard-draft-note">
        Setup is saved only while this page is open. New questions are saved to
        your question bank as you add them.
      </p>
    </>
  );
}
