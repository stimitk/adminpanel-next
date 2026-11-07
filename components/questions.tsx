"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorText, rowsOf } from "../lib/api";
import { questionFields } from "../lib/resources";
import {
  championshipLabelIds,
  championshipPhase,
  type ChampionshipPhase,
} from "../lib/championships";
import { isBlocked, isIncludedInLive, questionBody, questionTimestamps } from "../lib/questions";
import { formatDateTime } from "../lib/performance";
import { portal } from "../lib/portal";
import { plainRichText } from "../lib/rich-text";
import {
  championshipCode,
  questionCode,
  questionSetCode,
  teacherCode,
} from "../lib/codes";
import { useChampionshipList } from "./championships";
import { loadQuestionSets, loadTeachers } from "./pickers";
import { RichText } from "./rich-text-editor";
import type { Row } from "../lib/types";
import {
  ACTIONS_COLUMN,
  SERIAL_COLUMN,
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
  Drawer,
  EntityPicker,
  IconActions,
  IconButton,
  Identity,
  Pagination,
  useConfirm,
  useDebounced,
  SearchFilterBar,
  type BadgeVariant,
  type FilterChip,
  type PickerOption,
} from "./ui";

// Active unless an admin has blocked the question.
export function liveState(row: Row) {
  return isBlocked(row) ? "Inactive" : "Active";
}
export function LiveStateBadge({ row }: { row: Row }) {
  const state = String(row.live_state || liveState(row));
  return <Badge variant={state === "Active" ? "active" : "inactive"}>{state}</Badge>;
}

const STATUSES = [
  ["", "Any status"],
  ["active", "Active"],
  ["blocked", "Inactive"],
] as const;
// Live quiz: whether the question's set is used by a championship that is live today.
const LIVE_QUIZ = [
  ["", "Any"],
  ["yes", "In Use"],
  ["no", "Not in Use"],
] as const;

// In Use: the question's set is used by a championship that is live today.
// The championships themselves are listed in View.
function LiveQuizCell({ live }: { live: Row[] }) {
  return live.length ? (
    <Badge variant="info">In Use</Badge>
  ) : (
    <Badge variant="neutral">Not in Use</Badge>
  );
}

export function QuestionBank() {
  const admin = portal.kind === "admin";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [keyword, setKeyword] = useState("");
  const [teacher, setTeacher] = useState<PickerOption | null>(null);
  const [set, setSet] = useState<PickerOption | null>(null);
  const [status, setStatus] = useState("");
  const [liveQuiz, setLiveQuiz] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);
  const [blocking, setBlocking] = useState("");
  const [viewing, setViewing] = useState<Row | null>(null);
  const [result, setResult] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const { confirm, dialog } = useConfirm();
  const championships = useChampionshipList(0);
  // Typing waits for a pause before querying, so each keystroke is not a request.
  const q = useDebounced(keyword.trim(), 350);
  const label = set?.value || "";
  const filterKey = [q, teacher?.value, label, status, liveQuiz, pageSize].join("|");
  useEffect(() => setPage(1), [filterKey]);
  // One keyword searches every field: question ID and text, set name and ID,
  // teacher name and ID, and bank.
  const query = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
    ...(q ? { q, field: "all" } : {}),
    ...(teacher ? { teacherId: teacher.value } : {}),
    ...(label ? { labelId: label } : {}),
    ...(status ? { liveState: status } : {}),
    ...(liveQuiz ? { liveChampionship: liveQuiz } : {}),
  });
  const { data, loading, error } = useLoad<{ questions: Row[]; total: number }>(
    `/questions/?${query}`,
    revision,
  );
  // Set → championships that use it, for the Live quiz column and the details panel.
  const bySet = new Map<string, Row[]>();
  for (const c of championships.rows)
    for (const id of championshipLabelIds(c)) bySet.set(id, [...(bySet.get(id) || []), c]);
  const championshipsOf = (row: Row) => bySet.get(String(row.label_id)) || [];
  const liveIn = (row: Row) => championshipsOf(row).filter((c) => championshipPhase(c) === "Live");
  const setName = set?.label || "this question set";
  const rows = (data?.questions || []).map((row) => ({
    ...row,
    question_code: questionCode(row),
    live_state: liveState(row),
    label_code: row.label_id ? questionSetCode(row) : null,
    teacher_code: row.teacher_id ? teacherCode(row) : null,
  }));
  const chips: FilterChip[] = [
    ...(q ? [{ key: "keyword", label: `Search: “${q}”`, clear: () => setKeyword("") }] : []),
    ...(teacher
      ? [{ key: "teacher", label: `Championship Maker: ${teacher.label} (${teacher.detail?.split(" · ")[0]})`, clear: () => setTeacher(null) }]
      : []),
    ...(set ? [{ key: "set", label: `Question set: ${set.label}`, clear: () => setSet(null) }] : []),
    ...(status
      ? [{ key: "status", label: `Status: ${STATUSES.find(([v]) => v === status)?.[1]}`, clear: () => setStatus("") }]
      : []),
    ...(liveQuiz
      ? [{ key: "live", label: `Live quiz: ${LIVE_QUIZ.find(([v]) => v === liveQuiz)?.[1]}`, clear: () => setLiveQuiz("") }]
      : []),
  ];
  const panelFilters = [teacher, set, status, liveQuiz].filter(Boolean).length;
  function clearFilters() {
    setTeacher(null);
    setSet(null);
    setStatus("");
    setLiveQuiz("");
  }
  function clearAll() {
    setKeyword("");
    clearFilters();
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
      setViewing((current) =>
        current && String(current.question_id) === id ? { ...current, is_blocked: blocked } : current,
      );
      setRevision((v) => v + 1);
    } catch (e) {
      setResult({ kind: "error", text: errorText(e) });
    } finally {
      setBlocking("");
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
        description="Every question in kGamify. Each belongs to one question set, and championships draw their questions from sets."
        action={
          <Button href="/questions/new">
            New Question
          </Button>
        }
      />
      <Card>
        <SearchFilterBar
          value={keyword}
          onChange={setKeyword}
          label="Search questions"
          placeholder="Search by question ID or text, set name or ID, championship maker name or ID, or bank"
          chips={chips}
          filterCount={panelFilters}
          onClearFilters={clearFilters}
          onClearAll={clearAll}
        >
          {admin && (
            <EntityPicker
              label="Championship Maker"
              placeholder="Name or championship maker ID"
              value={teacher}
              onChange={setTeacher}
              load={loadTeachers}
            />
          )}
          <EntityPicker
            label="Question set"
            placeholder="Set name or set ID"
            value={set}
            onChange={setSet}
            load={loadQuestionSets}
          />
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label title="Whether the question's set is used by a championship that is live today">
            Live quiz
            <select value={liveQuiz} onChange={(e) => setLiveQuiz(e.target.value)}>
              {LIVE_QUIZ.map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </SearchFilterBar>
        {result && <Notice kind={result.kind}>{result.text}</Notice>}
        <div className="bulk-actions" role="group" aria-label="Results and selected questions">
          <span role="status" aria-live="polite">
            {loading
              ? "Searching…"
              : data
                ? `${data.total.toLocaleString()} ${data.total === 1 ? "question" : "questions"}${chips.length ? " match your filters" : ""}`
                : ""}
            {selected.length > 0 && ` · ${selected.length} selected`}
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
          {label && (
            <Button
              size="sm"
              variant="danger"
              loading={removing}
              disabled={removing || !selected.length}
              onClick={removeFromSet}
            >
              {removing ? "Removing…" : "Remove from set"}
            </Button>
          )}
        </div>
        {error ? (
          <Retry error={error} onRetry={() => setRevision((v) => v + 1)} />
        ) : (
          <>
            <div className="question-bank-table">
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
                question_code: (row) => <code className="entity-code">{String(row.question_code)}</code>,
                live_state: (row) => <LiveStateBadge row={row} />,
                live_quiz: (row) => <LiveQuizCell live={liveIn(row)} />,
                label_name: (row) => (
                  <Identity compact name={row.label_name} code={row.label_code as string | null} />
                ),
                teacher_name: (row) => (
                  <Identity compact name={row.teacher_name} code={row.teacher_code as string | null} />
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
                [SERIAL_COLUMN, "Sr. No."],
                ["live_state", "Status"],
                [ACTIONS_COLUMN, "Actions"],
                ["question_code", "Question ID"],
                ["question_text", "Question"],
                ["label_name", "Question set"],
                ["teacher_name", "Championship Maker"],
                ["live_quiz", "Live quiz"],
              ]}
              actions={(row) => {
                const id = String(row.question_id);
                const blocked = isBlocked(row);
                return (
                  <IconActions>
                    <IconButton
                      icon="view"
                      label="View question details"
                      onClick={() => setViewing(row)}
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
                  </IconActions>
                );
              }}
            />
            </div>
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
      {viewing && (
        <QuestionDetails
          row={viewing}
          championships={championshipsOf(viewing)}
          championshipsLoading={championships.loading}
          admin={admin}
          blocking={blocking === String(viewing.question_id)}
          onBlock={() => toggleBlock(viewing)}
          onClose={() => setViewing(null)}
        />
      )}
      {dialog}
    </>
  );
}

const phaseBadge: Record<ChampionshipPhase, BadgeVariant> = {
  Live: "active",
  Scheduled: "info",
  Ended: "neutral",
  Inactive: "inactive",
  Blocked: "suspended",
};

// One question with its place in the hierarchy: bank → set → championships.
function QuestionDetails({
  row,
  championships,
  championshipsLoading,
  admin,
  blocking,
  onBlock,
  onClose,
}: {
  row: Row;
  championships: Row[];
  championshipsLoading: boolean;
  admin: boolean;
  blocking: boolean;
  onBlock: () => void;
  onClose: () => void;
}) {
  const blocked = isBlocked(row);
  const { created, updated } = questionTimestamps(row);
  // Read-only view: the correct answer is never shown and questions aren't edited here.
  return (
    <Drawer
      isOpen
      onClose={onClose}
      title="Question details"
      description={
        <>
          <code className="entity-code">{questionCode(row)}</code> · <LiveStateBadge row={{ ...row, live_state: liveState(row) }} />
        </>
      }
    >
      <dl className="details-grid compact">
        {[
          ["Question set", <Identity compact key="set" name={row.label_name} code={row.label_id ? questionSetCode(row) : null} />],
          ["Championship Maker", <Identity compact key="teacher" name={row.teacher_name} code={row.teacher_id ? teacherCode(row) : null} />],
          ["Question bank", String(row.bank_name || "—")],
          ["Coins", String(row.total_coins ?? "—")],
          ["Expected time", row.expected_time_sec ? `${row.expected_time_sec} sec` : "—"],
          ["Created at", formatDateTime(created)],
          ["Updated at", updated ? formatDateTime(updated) : created ? "Never updated" : "—"],
        ].map(([name, value]) => (
          <div key={String(name)}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="drawer-section-title">Championships using this question’s set</h3>
      {championshipsLoading ? (
        <Loading text="Loading championships…" />
      ) : !row.label_id ? (
        <p className="muted">Not in a question set, so no championship can use it.</p>
      ) : championships.length ? (
        <ul className="linked-list">
          {championships.map((c) => {
            const phase = championshipPhase(c);
            return (
              <li key={String(c.champ_id)}>
                <Link href={`/championships/${encodeURIComponent(String(c.champ_id))}`}>
                  {String(c.champ_name)}
                </Link>
                <code className="entity-code">{championshipCode(c)}</code>
                <Badge variant={phaseBadge[phase]}>{phase}</Badge>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">No championship uses this set yet.</p>
      )}
      {!blocked && !isIncludedInLive(row) && championships.length > 0 && (
        <p className="muted">Excluded in its set, so live quizzes skip it.</p>
      )}
      <div className="form-actions question-detail-actions">
        {row.label_id ? (
          <Button variant="secondary" href={`/labels/${encodeURIComponent(String(row.label_id))}`}>
            Open question set
          </Button>
        ) : null}
        {admin && (
          <Button variant={blocked ? "secondary" : "danger"} loading={blocking} disabled={blocking} onClick={onBlock}>
            {blocked ? "Unblock question" : "Block question"}
          </Button>
        )}
      </div>
      <h3 className="drawer-section-title">Question</h3>
      <div className="question-detail">
        <RichText value={row.question_text} />
        <ol className="question-detail-options">
          {[1, 2, 3, 4].map((n) => (
            <li key={n}>
              <span>{plainRichText(row[`option${n}_text`]) || "—"}</span>
            </li>
          ))}
        </ol>
      </div>
    </Drawer>
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
