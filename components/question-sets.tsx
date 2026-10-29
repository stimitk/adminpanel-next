"use client";
import { useEffect, useState } from "react";
import { api, rowsOf } from "../lib/api";
import { questionFields, resources } from "../lib/resources";
import type { Row } from "../lib/types";
import dynamic from "next/dynamic";
import {
  DataTable,
  Form,
  Heading,
  Loading,
  Notice,
  Retry,
  useLoad,
} from "./ui";

const BulkImport = dynamic(
  () => import("./bulk-import").then((m) => ({ default: m.BulkImport })),
  { loading: () => <Loading text="Loading bulk import…" />, ssr: false }
);

const QuestionSetWizard = dynamic(
  () =>
    import("./question-set-wizard").then((m) => ({
      default: m.QuestionSetWizard,
    })),
  { loading: () => <Loading text="Loading wizard…" />, ssr: false }
);

export function QuestionSets({
  create = false,
  importFirst = false,
}: {
  create?: boolean;
  importFirst?: boolean;
}) {
  const [labelsRevision, setLabelsRevision] = useState(0);
  const [questionsRevision, setQuestionsRevision] = useState(0);
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(create);
  const [tab, setTab] = useState<"questions" | "manual" | "import">(
    importFirst ? "import" : "questions",
  );
  const [importing, setImporting] = useState(false);
  const [questionMessage, setQuestionMessage] = useState("");
  const [page, setPage] = useState(1);
  const labels = useLoad<unknown>("/questions/labels", labelsRevision);
  const sets = rowsOf(labels.data);
  useEffect(() => {
    if (!selected && sets.length) setSelected(String(sets[0].label_id));
  }, [labels.data, selected]);
  const current = sets.find((row) => String(row.label_id) === selected);
  const questions = useLoad<{ questions: Row[]; total: number }>(
    selected
      ? `/questions/?${new URLSearchParams({ labelId: selected, page: String(page), limit: "20" })}`
      : null,
    questionsRevision,
  );
  const refresh = () => setQuestionsRevision((v) => v + 1);
  if (creating)
    return (
      <QuestionSetWizard
        onCancel={() => {
          setCreating(false);
          setLabelsRevision((v) => v + 1);
          refresh();
        }}
        onComplete={(id) => {
          setSelected(id);
          setPage(1);
          setTab("questions");
          setQuestionMessage("Question set is ready.");
          setCreating(false);
          setLabelsRevision((v) => v + 1);
          refresh();
        }}
      />
    );
  return (
    <>
      <Heading
        title="Question Sets"
        description="Create a set, then add questions individually or import them from a file."
        action={
          <button disabled={importing} onClick={() => setCreating(!creating)}>
            {creating ? "Close new set" : "New question set"}
          </button>
        }
      />
      <div className="question-sets-workspace">
        <section className="paper question-set-list" aria-label="Question sets">
          <h2>Your question sets</h2>
          {labels.loading ? (
            <Loading />
          ) : labels.error ? (
            <Retry
              error={labels.error}
              onRetry={() => setLabelsRevision((v) => v + 1)}
            />
          ) : sets.length ? (
            <ul>
              {sets.map((row) => (
                <li key={String(row.label_id)}>
                  <button
                    className={
                      selected === String(row.label_id)
                        ? "set-picker selected"
                        : "set-picker"
                    }
                    disabled={importing}
                    aria-pressed={selected === String(row.label_id)}
                    onClick={() => {
                      setSelected(String(row.label_id));
                      setPage(1);
                    }}
                  >
                    {String(row.label_name)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Create a question set to get started.</p>
          )}
        </section>
        <section className="paper question-set-content">
          {!selected ? (
            <Notice kind="info">
              Choose a question set or create a new one to add questions.
            </Notice>
          ) : (
            <>
              <h2>{String(current?.label_name || "Question set")}</h2>
              <div
                className="set-view-switch"
                role="group"
                aria-label="Question set actions"
              >
                {(
                  [
                    ["questions", "Questions"],
                    ["manual", "Add question"],
                    ["import", "Import questions"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={tab === value ? "small" : "small secondary"}
                    aria-pressed={tab === value}
                    disabled={importing}
                    onClick={() => setTab(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tab === "questions" &&
                (questions.loading ? (
                  <Loading />
                ) : questions.error ? (
                  <Retry error={questions.error} onRetry={refresh} />
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
                        Page {page} · {questions.data?.total || 0} questions
                      </span>
                      <button
                        className="secondary"
                        disabled={
                          page * 20 >= Number(questions.data?.total || 0)
                        }
                        onClick={() => setPage((v) => v + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </>
                ))}
              {tab === "manual" && questionMessage && (
                <Notice kind="success">{questionMessage}</Notice>
              )}
              {tab === "manual" && (
                <Form
                  key={`manual-${selected}-${questionsRevision}`}
                  fields={questionFields.filter(
                    (field) => field.name !== "labelId",
                  )}
                  submitLabel="Add to question set"
                  secondaryAction={
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setTab("questions")}
                    >
                      View questions
                    </button>
                  }
                  onSubmit={async (body) => {
                    await api("/questions/", {
                      method: "POST",
                      body: {
                        ...body,
                        labelId: /^\d+$/.test(selected)
                          ? Number(selected)
                          : selected,
                      },
                    });
                    setQuestionMessage("Question added to this set.");
                    refresh();
                  }}
                />
              )}
              {tab === "import" && (
                <BulkImport
                  key={selected}
                  setId={selected}
                  setName={String(current?.label_name || "this question set")}
                  embedded
                  onImported={refresh}
                  onBusyChange={setImporting}
                />
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
