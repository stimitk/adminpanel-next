"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, errorText, rowsOf } from "../lib/api";
import { questionFields } from "../lib/resources";
import { correctAnswerLabel } from "../lib/answers";
import { isBlocked, isIncludedInLive, questionBody } from "../lib/questions";
import { portal } from "../lib/portal";
import { plainRichText } from "../lib/rich-text";
import { questionSetCode, teacherCode } from "../lib/codes";
import { loadQuestionSets, loadTeachers } from "./pickers";
import type { Row } from "../lib/types";
import {
  DataTable,
  Form,
  Heading,
  Loading,
  Notice,
  Retry,
  useLoad,
  Card,
  Button,
  Badge,
  ActionIcon,
  EntityPicker,
  IconActions,
  IconButton,
  Pagination,
  useConfirm,
  useDebounced,
  type PickerOption,
} from "./ui";

export function liveState(row: Row) {
  return isBlocked(row)
    ? "Blocked"
    : isIncludedInLive(row)
      ? "Included"
      : "Excluded";
}
export function LiveStateBadge({ row }: { row: Row }) {
  const state = String(row.live_state || liveState(row));
  return (
    <Badge
      variant={
        state === "Blocked"
          ? "suspended"
          : state === "Included"
            ? "active"
            : "inactive"
      }
    >
      {state}
    </Badge>
  );
}

const SEARCH_FIELDS = [
  ["all", "All fields"],
  ["bank", "Question bank name"],
  ["teacher", "Teacher name"],
  ["teacherId", "Teacher ID"],
  ["set", "Question set name"],
] as const;
const LIVE_STATES = [
  ["", "Any live quiz state"],
  ["included", "Included"],
  ["excluded", "Excluded"],
  ["blocked", "Blocked"],
] as const;

function Identity({ name, code }: { name: unknown; code: string | null }) {
  if (!name && !code) return <>—</>;
  return (
    <span className="identity">
      <span>{String(name || "—")}</span>
      {code && <code className="entity-code">{code}</code>}
    </span>
  );
}

export function QuestionBank() {
  const admin = portal.kind === "admin";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [keyword, setKeyword] = useState("");
  const [field, setField] = useState<(typeof SEARCH_FIELDS)[number][0]>("all");
  const [text, setText] = useState("");
  const [teacher, setTeacher] = useState<PickerOption | null>(null);
  const [set, setSet] = useState<PickerOption | null>(null);
  const [liveFilter, setLiveFilter] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);
  const [blocking, setBlocking] = useState("");
  const [result, setResult] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const { confirm, dialog } = useConfirm();
  // Typing waits for a pause before querying, so each keystroke is not a request.
  const q = useDebounced(keyword.trim(), 350);
  const search = useDebounced(text.trim(), 350);
  const label = set?.value || "";
  const filterKey = [q, field, search, teacher?.value, label, liveFilter, pageSize].join("|");
  useEffect(() => setPage(1), [filterKey]);
  const query = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
    ...(q ? { q, field } : {}),
    ...(search ? { search } : {}),
    ...(teacher ? { teacherId: teacher.value } : {}),
    ...(label ? { labelId: label } : {}),
    ...(liveFilter ? { liveState: liveFilter } : {}),
  });
  const { data, loading, error } = useLoad<{ questions: Row[]; total: number }>(
    `/questions/?${query}`,
    revision,
  );
  const setName = set?.label || "this question set";
  const rows = (data?.questions || []).map((row) => ({
    ...row,
    correct_answer: correctAnswerLabel(row.correct_answer),
    live_state: liveState(row),
    label_code: row.label_id ? questionSetCode(row) : null,
    teacher_code: row.teacher_id ? teacherCode(row) : null,
  }));
  const chips: [string, string, () => void][] = [
    ...(q
      ? [[`${SEARCH_FIELDS.find(([v]) => v === field)?.[1]}: “${q}”`, "keyword", () => setKeyword("")] as [string, string, () => void]]
      : []),
    ...(search ? [[`Question text: “${search}”`, "text", () => setText("")] as [string, string, () => void]] : []),
    ...(teacher ? [[`Teacher: ${teacher.label} (${teacher.detail?.split(" · ")[0]})`, "teacher", () => setTeacher(null)] as [string, string, () => void]] : []),
    ...(set ? [[`Question set: ${set.label}`, "set", () => setSet(null)] as [string, string, () => void]] : []),
    ...(liveFilter
      ? [[`Live quiz: ${LIVE_STATES.find(([v]) => v === liveFilter)?.[1]}`, "live", () => setLiveFilter("")] as [string, string, () => void]]
      : []),
  ];
  function clearAll() {
    setKeyword("");
    setText("");
    setField("all");
    setTeacher(null);
    setSet(null);
    setLiveFilter("");
    setResult(null);
  }

  async function toggleBlock(row: Row) {
    const id = String(row.question_id);
    const blocked = !isBlocked(row);
    if (
      !(await confirm({
        title: blocked ? "Block question?" : "Unblock question?",
        message: blocked
          ? "It will not appear in any live quiz until it is unblocked. It stays in the Question Bank and its set."
          : "It can appear in live quizzes again if it is included in its set.",
        confirmLabel: blocked ? "Block" : "Unblock",
        isDangerous: blocked,
      }))
    )
      return;
    setBlocking(id);
    setResult(null);
    try {
      await api(`/admin/questions/${encodeURIComponent(id)}/block`, {
        method: "PATCH",
        body: { blocked },
      });
      setResult({
        kind: "success",
        text: blocked
          ? "Question blocked. It will not appear in live quizzes."
          : "Question unblocked. It can appear in live quizzes again if it is included in its set.",
      });
      setRevision((v) => v + 1);
    } catch (e) {
      setResult({ kind: "error", text: errorText(e) });
    } finally {
      setBlocking("");
    }
  }
  async function remove(row: Row) {
    if (
      !(await confirm({
        title: "Delete question?",
        message: "The question is permanently removed from the Question Bank and from its set. This cannot be undone.",
        confirmLabel: "Delete",
        isDangerous: true,
      }))
    )
      return;
    try {
      await api(`/questions/${encodeURIComponent(String(row.question_id))}`, {
        method: "DELETE",
      });
      setResult({ kind: "success", text: "Question deleted." });
      if (page > 1 && rows.length === 1) setPage((v) => v - 1);
      setRevision((v) => v + 1);
    } catch (e) {
      setResult({ kind: "error", text: errorText(e) });
    }
  }
  // Selection is scoped to what is on screen; changing the page or filter clears it.
  useEffect(() => setSelected([]), [page, filterKey, revision]);

  async function removeFromSet() {
    if (removing || !label) return;
    const targets = (data?.questions || []).filter(
      (row) =>
        selected.includes(String(row.question_id)) &&
        String(row.label_id) === label,
    );
    if (!targets.length) {
      setResult({
        kind: "error",
        text: "Select at least one question from this question set.",
      });
      return;
    }
    const count = `${targets.length} ${targets.length === 1 ? "question" : "questions"}`;
    if (
      !(await confirm({
        title: "Remove from question set?",
        message: `Remove ${count} from “${setName}”? They stay in the Question Bank and can be added to a set again by editing them.`,
        confirmLabel: "Remove",
        isDangerous: true,
      }))
    )
      return;
    setRemoving(true);
    setResult(null);
    let failed = 0;
    let firstError = "";
    for (const row of targets) {
      try {
        await api(`/questions/${encodeURIComponent(String(row.question_id))}`, {
          method: "PUT",
          body: { ...questionBody(row), labelId: null },
        });
      } catch (e) {
        failed += 1;
        firstError ||= errorText(e);
      }
    }
    const removed = targets.length - failed;
    setResult(
      failed
        ? {
            kind: "error",
            text: `${removed} of ${targets.length} questions removed from “${setName}”. ${firstError}`,
          }
        : {
            kind: "success",
            text: `${count} removed from “${setName}”. They are still in the Question Bank.`,
          },
    );
    setRemoving(false);
    if (removed) {
      // Emptying the last page of a set would otherwise leave a blank page.
      if (page > 1 && removed >= (data?.questions.length || 0))
        setPage((v) => v - 1);
      setRevision((v) => v + 1);
    }
  }

  return (
    <>
      <Heading
        title="Question Bank"
        description="Search across question banks, teachers and question sets. Results load one page at a time."
        action={
          <Button href="/questions/new">
            New Question
          </Button>
        }
      />
      <Card>
        <form className="search-panel" role="search" onSubmit={(e) => e.preventDefault()}>
          <div className="search-main">
            <label className="search-keyword">
              Search
              <span className="search-input">
                <ActionIcon name="search" />
                <input
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Question bank, teacher name, teacher ID (e.g. TCH-0103) or question set"
                  maxLength={100}
                  aria-describedby="bank-search-help"
                />
              </span>
            </label>
            <label className="search-scope">
              Search in
              <select value={field} onChange={(e) => setField(e.target.value as typeof field)}>
                {SEARCH_FIELDS.map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <small id="bank-search-help" className="muted">
            Partial, case-insensitive matches. Words can be in any order. Teachers
            with the same name are told apart by their teacher ID.
          </small>
          <div className="search-filters">
            {admin && (
              <EntityPicker
                label="Teacher"
                placeholder="Name or teacher ID"
                value={teacher}
                onChange={setTeacher}
                load={loadTeachers}
              />
            )}
            <EntityPicker
              label="Question set"
              placeholder="Set name, bank or set ID"
              value={set}
              onChange={setSet}
              load={loadQuestionSets}
            />
            <label>
              Question text
              <input
                type="search"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Words in the question"
                maxLength={100}
              />
            </label>
            <label>
              Live quiz
              <select value={liveFilter} onChange={(e) => setLiveFilter(e.target.value)}>
                {LIVE_STATES.map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {chips.length > 0 && (
            <div className="filter-chips" aria-label="Active filters">
              {chips.map(([name, key, clear]) => (
                <span className="filter-chip" key={key}>
                  {name}
                  <button type="button" aria-label={`Remove filter ${name}`} onClick={clear}>
                    <ActionIcon name="close" size={12} />
                  </button>
                </span>
              ))}
              <Button size="sm" variant="text" onClick={clearAll}>
                Clear all
              </Button>
            </div>
          )}
        </form>
        {result && <Notice kind={result.kind}>{result.text}</Notice>}
        <div className="bulk-actions" role="group" aria-label="Selected questions">
          <span role="status">
            {selected.length
              ? `${selected.length} selected`
              : label
                ? "Select questions to remove them from this set."
                : "Filter by a question set to remove questions from it."}
          </span>
          {selected.length > 0 && (
            <Button
              size="sm"
              variant="text"
              disabled={removing}
              onClick={() => setSelected([])}
            >
              Clear selection
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            loading={removing}
            disabled={removing || !label || !selected.length}
            onClick={removeFromSet}
          >
            {removing ? "Removing…" : "Remove from set"}
          </Button>
        </div>
        {error ? (
          <Retry error={error} onRetry={() => setRevision((v) => v + 1)} />
        ) : (
          <>
            <p className="results-summary muted" role="status" aria-live="polite">
              {loading
                ? "Searching…"
                : data
                  ? `${data.total.toLocaleString()} ${data.total === 1 ? "question" : "questions"}${chips.length ? " match your filters" : " in the bank"}`
                  : ""}
            </p>
            <DataTable
              rows={rows}
              loading={loading}
              searchable={false}
              pageSize={0}
              serial
              serialOffset={(page - 1) * pageSize}
              emptyMessage={chips.length ? "No questions match your filters" : "No questions yet"}
              emptyDescription={
                chips.length ? (
                  <>
                    Try fewer words, a different field, or remove a filter.{" "}
                    <button type="button" className="text-button" onClick={clearAll}>
                      Clear all filters
                    </button>
                  </>
                ) : (
                  "Questions added to any set appear here."
                )
              }
              rowClassName={(row) => (isBlocked(row) ? "is-blocked" : undefined)}
              render={{
                live_state: (row) => <LiveStateBadge row={row} />,
                options: (row) => (
                  <ol className="option-list">
                    {[1, 2, 3, 4].map((n) => (
                      <li key={n}>{plainRichText(row[`option${n}_text`]) || "—"}</li>
                    ))}
                  </ol>
                ),
                label_name: (row) => (
                  <Identity name={row.label_name} code={row.label_code as string | null} />
                ),
                teacher_name: (row) => (
                  <Identity name={row.teacher_name} code={row.teacher_code as string | null} />
                ),
              }}
              selection={{
                selected,
                onChange: setSelected,
                rowId: (row) => String(row.question_id),
                rowLabel: (row) =>
                  plainRichText(row.question_text).slice(0, 80) || "question",
                disabled: removing,
              }}
              columns={[
                ["question_text", "Question"],
                ["options", "Options"],
                ["correct_answer", "Correct"],
                ["bank_name", "Question bank"],
                ["label_name", "Question set"],
                ["teacher_name", "Teacher"],
                ["live_state", "Live quiz"],
                ["total_coins", "Coins"],
              ]}
              actions={(row) => {
                const id = String(row.question_id);
                const blocked = isBlocked(row);
                return (
                  <IconActions>
                    <IconButton
                      icon="edit"
                      label="Edit question"
                      href={`/questions/${encodeURIComponent(id)}/edit`}
                    />
                    {admin && (
                      <IconButton
                        icon={blocked ? "unblock" : "block"}
                        label={blocked ? "Unblock question" : "Block question"}
                        tone={blocked ? "default" : "warning"}
                        loading={blocking === id}
                        disabled={removing || !!blocking}
                        onClick={() => toggleBlock(row)}
                      />
                    )}
                    <IconButton
                      icon="delete"
                      label="Delete question"
                      tone="danger"
                      disabled={removing}
                      onClick={() => remove(row)}
                    />
                  </IconActions>
                );
              }}
            />
            {data && (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={data.total}
                onPage={setPage}
                onPageSize={setPageSize}
                disabled={loading}
              />
            )}
          </>
        )}
      </Card>
      {dialog}
    </>
  );
}

export function QuestionEditor({ id }: { id?: string }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Row | null>(null);
  const [lookup, setLookup] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setBusy(true);
    setError("");
    api<{ questions: Row[] }>(`/questions/?${new URLSearchParams({ limit: "100", page: "1", questionId: id })}`, {
      signal: controller.signal,
    })
      .then((data) => {
        const found = data.questions.find((row) => String(row.question_id) === id);
        if (found) setLoaded(found);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorText(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [id]);

  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setLoaded(null);
    try {
      const query = new URLSearchParams({
        limit: "100",
        page: "1",
        ...(lookup ? { search: lookup } : {}),
      });
      const data = await api<{ questions: Row[] }>(`/questions/?${query}`);
      const found = data.questions.find((row) => String(row.question_id) === id);
      if (!found)
        throw new Error(
          "Question not found. Try searching a word from the question, or return to the question bank.",
        );
      setLoaded(found);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const initial: Record<string, unknown> = loaded ? questionBody(loaded) : {};

  const fields = id
    ? questionFields.filter((f) => f.name !== "expectedTimeSeconds")
    : questionFields;

  return (
    <>
      <Heading title={id ? "Edit Question" : "New Question"} />
      {id && !loaded && (
        <Card>
          <p>
            Load the question before editing. You can narrow the lookup with a
            word from its text.
          </p>
          <form className="filter-bar" onSubmit={load}>
            <label>
              Question text
              <input
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                placeholder="Optional search text"
              />
            </label>
            <Button type="submit" loading={busy} disabled={busy}>
              Load question
            </Button>
          </form>
          {error && <Notice kind="error">{error}</Notice>}
        </Card>
      )}
      {(!id || loaded) && (
        <Card>
          <Form
            key={id || "new"}
            fields={fields}
            initial={initial}
            submitLabel={id ? "Save question" : "Add question"}
            onSubmit={async (values) => {
              await api(
                id ? `/questions/${encodeURIComponent(id)}` : "/questions/",
                { method: id ? "PUT" : "POST", body: values },
              );
              router.push("/questions");
            }}
          />
        </Card>
      )}
    </>
  );
}
