"use client";
import { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { isBlocked, isIncludedInLive, questionBody } from "../lib/questions";
import { plainRichText } from "../lib/rich-text";
import type { Row } from "../lib/types";
import {
  Button,
  DataTable,
  Loading,
  Notice,
  Retry,
  useDebounced,
  useLoad,
} from "./ui";

type Change = { row: Row; include: boolean };

// Checked questions are the ones live quizzes draw from. Edits are kept locally
// (across pages) until saved, so authors can adjust freely before publishing.
export function LiveQuestionSelection({
  setId,
  setName,
  revision,
  onDirtyChange,
}: {
  setId: string;
  setName: string;
  revision: number;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const search = useDebounced(text.trim(), 350);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(0);
  const [changes, setChanges] = useState<Record<string, Change>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const loadRevision = revision + saved;
  const questions = useLoad<{ questions: Row[]; total: number }>(
    `/questions/?${new URLSearchParams({ labelId: setId, page: String(page), limit: "20", ...(search ? { search } : {}) })}`,
    loadRevision,
  );
  const included = useLoad<{ total: number }>(
    `/questions/?${new URLSearchParams({ labelId: setId, includeInLive: "true", page: "1", limit: "1" })}`,
    loadRevision,
  );
  // While searching, the set's full size still comes from an unfiltered count.
  const all = useLoad<{ total: number }>(
    search
      ? `/questions/?${new URLSearchParams({ labelId: setId, page: "1", limit: "1" })}`
      : null,
    loadRevision,
  );
  // Search the whole set on the server, starting again from page 1.
  useEffect(() => setPage(1), [search]);
  useEffect(() => {
    if (questions.data) setReady(true);
  }, [questions.data]);
  const pending = Object.values(changes);
  const dirty = pending.length > 0;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const total = Number(questions.data?.total || 0);
  const setTotal = search ? Number(all.data?.total || 0) : total;
  const includedTotal =
    Number(included.data?.total || 0) +
    pending.reduce((sum, change) => sum + (change.include ? 1 : -1), 0);
  const pageRows = questions.data?.questions || [];
  const includes = (row: Row) =>
    changes[String(row.question_id)]?.include ?? isIncludedInLive(row);
  const rows: Row[] = pageRows.map((row) => ({
    ...row,
    live_status: isBlocked(row)
      ? "Blocked by an admin"
      : `${includes(row) ? "Included" : "Excluded"}${changes[String(row.question_id)] ? " · unsaved" : ""}`,
  }));
  // Blocked questions never reach a live quiz, so they cannot be ticked.
  const checked = pageRows
    .filter((row) => !isBlocked(row) && includes(row))
    .map((row) => String(row.question_id));

  function select(ids: string[]) {
    setResult(null);
    setChanges((previous) => {
      const next = { ...previous };
      for (const row of questions.data?.questions || []) {
        if (isBlocked(row)) continue;
        const id = String(row.question_id);
        const include = ids.includes(id);
        if (include === isIncludedInLive(row)) delete next[id];
        else next[id] = { row, include };
      }
      return next;
    });
  }

  async function save() {
    if (saving || !dirty) return;
    if (included.error || included.loading) {
      setResult({
        kind: "error",
        text: "Cannot confirm how many questions are included. Retry before saving.",
      });
      return;
    }
    if (includedTotal < 1) {
      setResult({
        kind: "error",
        text: "Include at least one question so live quizzes using this set have questions to show.",
      });
      return;
    }
    setSaving(true);
    setResult(null);
    const failed: Record<string, Change> = {};
    let firstError = "";
    for (const [id, change] of Object.entries(changes)) {
      try {
        await api(`/questions/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: { ...questionBody(change.row), includeInLive: change.include },
        });
      } catch (error) {
        failed[id] = change;
        firstError ||= errorText(error);
      }
    }
    const failures = Object.keys(failed).length;
    setChanges(failed);
    setResult(
      failures
        ? {
            kind: "error",
            text: `${pending.length - failures} of ${pending.length} changes saved. ${firstError}`,
          }
        : {
            kind: "success",
            text: "Live quiz selection saved. Championships using this set will only show the included questions.",
          },
    );
    setSaving(false);
    setSaved((v) => v + 1);
  }

  if (!ready && questions.loading) return <Loading />;
  if (questions.error)
    return (
      <Retry error={questions.error} onRetry={() => setSaved((v) => v + 1)} />
    );
  return (
    <>
      <p className="muted live-selection-help">
        Check the questions to show when a quiz using this set goes live.
        Unchecked questions stay in this set and the Question Bank, unchanged.
      </p>
      {result && <Notice kind={result.kind}>{result.text}</Notice>}
      {included.error && (
        <Retry
          error={included.error}
          onRetry={() => setSaved((v) => v + 1)}
        />
      )}
      <div
        className="bulk-actions"
        role="group"
        aria-label={`Live quiz selection for ${setName}`}
      >
        <span role="status">
          {included.loading
            ? "Counting included questions…"
            : `${Math.max(0, includedTotal)} of ${setTotal} questions will be used in live quizzes`}
          {dirty &&
            ` · ${pending.length} unsaved ${pending.length === 1 ? "change" : "changes"}`}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={!dirty || saving}
          onClick={() => {
            setChanges({});
            setResult(null);
          }}
        >
          Discard changes
        </Button>
        <Button
          size="sm"
          loading={saving}
          disabled={!dirty || saving}
          onClick={save}
        >
          {saving ? "Saving…" : "Save selection"}
        </Button>
      </div>
      <DataTable
        rows={rows}
        loading={questions.loading}
        search={text}
        onSearchChange={setText}
        searchPlaceholder="Search question text"
        selection={{
          title: "Include",
          selected: checked,
          onChange: select,
          rowId: (row) => String(row.question_id),
          rowLabel: (row) =>
            plainRichText(row.question_text).slice(0, 80) || "question",
          disabled: saving,
          isDisabled: isBlocked,
        }}
        rowClassName={(row) => (isBlocked(row) ? "is-blocked" : undefined)}
        columns={[
          ["question_text", "Question"],
          ["option1_text", "Option 1"],
          ["option2_text", "Option 2"],
          ["option3_text", "Option 3"],
          ["option4_text", "Option 4"],
          ["total_coins", "Coins"],
          ["live_status", "Live quiz"],
        ]}
      />
      <div className="pagination">
        <button
          className="secondary"
          disabled={page === 1 || saving}
          onClick={() => setPage((v) => v - 1)}
        >
          Previous
        </button>
        <span>
          Page {page} · {total} {search ? "matching " : ""}questions
        </span>
        <button
          className="secondary"
          disabled={page * 20 >= total || saving}
          onClick={() => setPage((v) => v + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
