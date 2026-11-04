"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorText, rowsOf } from "../lib/api";
import { portal } from "../lib/portal";
import { championshipCode, questionSetCode, teacherCode } from "../lib/codes";
import { championshipLabelIds } from "../lib/championships";
import { matchesRecord } from "../lib/search";
import { questionFields } from "../lib/resources";
import type { Row } from "../lib/types";
import dynamic from "next/dynamic";
import { useChampionshipList } from "./championships";
import { LiveQuestionSelection } from "./live-question-selection";
import { loadTeachers } from "./pickers";
import {
  ACTIONS_COLUMN,
  Button,
  Card,
  DataTable,
  EntityPicker,
  Form,
  Heading,
  IconActions,
  IconButton,
  Loading,
  Modal,
  Notice,
  Retry,
  SearchFilterBar,
  StatusBadge,
  useLoad,
  type FilterChip,
  type PickerOption,
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

type Tab = "questions" | "manual" | "import";
const setPath = (id: unknown, tab?: Tab) =>
  `/labels/${encodeURIComponent(String(id))}${tab && tab !== "questions" ? `?tab=${tab}` : ""}`;

const SET_STATUSES = [
  ["", "Any status"],
  ["active", "Active"],
  ["inactive", "Inactive"],
] as const;
const isActiveSet = (row: Row) => Number(row.status ?? 1) === 1;

// Main listing. Set and teacher IDs tell apart sets or teachers with the same name.
export function QuestionSets({
  create = false,
  importFirst = false,
}: {
  create?: boolean;
  importFirst?: boolean;
}) {
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(create);
  const [keyword, setKeyword] = useState("");
  const [teacher, setTeacher] = useState<PickerOption | null>(null);
  const [status, setStatus] = useState("");
  const [championshipId, setChampionshipId] = useState("");
  const labels = useLoad<unknown>("/questions/labels", revision);
  // Championships pick their question sets, so a set can be filtered by championship.
  const championships = useChampionshipList(0);
  const championship = championships.rows.find((c) => String(c.champ_id) === championshipId);
  const championshipSets = championship ? championshipLabelIds(championship) : null;
  const sets = rowsOf(labels.data).map((row): Row => {
    const teacher = { teacher_id: row.teacher_id ?? row.created_by, teacher_code: row.teacher_code };
    return {
      ...row,
      teacher_id: teacher.teacher_id,
      label_code: questionSetCode(row),
      teacher_code: teacher.teacher_id ? teacherCode(teacher) : null,
    };
  });
  // Search and every filter apply together.
  const visible = sets.filter(
    (row) =>
      matchesRecord(row, keyword, "all") &&
      (!teacher || String(row.teacher_id) === teacher.value) &&
      (!status || isActiveSet(row) === (status === "active")) &&
      (!championshipSets || championshipSets.includes(String(row.label_id))),
  );
  const chips: FilterChip[] = [
    ...(keyword.trim() ? [{ key: "keyword", label: `Search: “${keyword.trim()}”`, clear: () => setKeyword("") }] : []),
    ...(teacher
      ? [{ key: "teacher", label: `Teacher: ${teacher.label} (${teacher.detail?.split(" · ")[0]})`, clear: () => setTeacher(null) }]
      : []),
    ...(status
      ? [{ key: "status", label: `Status: ${SET_STATUSES.find(([v]) => v === status)?.[1]}`, clear: () => setStatus("") }]
      : []),
    ...(championship
      ? [{ key: "championship", label: `Championship: ${championship.champ_name} (${championshipCode(championship)})`, clear: () => setChampionshipId("") }]
      : []),
  ];
  const filterCount = [teacher, status, championshipId].filter(Boolean).length;
  const clearFilters = () => {
    setTeacher(null);
    setStatus("");
    setChampionshipId("");
  };
  if (creating)
    return (
      <QuestionSetWizard
        onCancel={() => {
          setCreating(false);
          setRevision((v) => v + 1);
        }}
        onComplete={(id) => router.push(`${setPath(id)}?created=1`)}
      />
    );
  return (
    <>
      <Heading
        title="Question Sets"
        action={<Button onClick={() => setCreating(true)}>New question set</Button>}
      />
      {importFirst && (
        <Notice kind="info">
          Choose the question set to import into, then select View. The set
          opens on its import tab.
        </Notice>
      )}
      <Card>
        <SearchFilterBar
          value={keyword}
          onChange={setKeyword}
          label="Search question sets"
          placeholder="Search by set name or ID, teacher name or ID, or bank"
          chips={chips}
          filterCount={filterCount}
          onClearFilters={clearFilters}
          onClearAll={() => {
            setKeyword("");
            clearFilters();
          }}
        >
          {portal.kind === "admin" && (
            <EntityPicker
              label="Teacher"
              placeholder="Name or teacher ID"
              value={teacher}
              onChange={setTeacher}
              load={loadTeachers}
            />
          )}
          <label>
            Set status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {SET_STATUSES.map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Championship
            <select
              value={championshipId}
              disabled={championships.loading}
              onChange={(e) => setChampionshipId(e.target.value)}
            >
              <option value="">{championships.loading ? "Loading…" : "Any championship"}</option>
              {championships.rows.map((c) => (
                <option key={String(c.champ_id)} value={String(c.champ_id)}>
                  {String(c.champ_name)} ({championshipCode(c)})
                </option>
              ))}
            </select>
          </label>
        </SearchFilterBar>
        {labels.error ? (
          <Retry error={labels.error} onRetry={() => setRevision((v) => v + 1)} />
        ) : (
          <DataTable
            rows={visible}
            loading={labels.loading}
            serial
            searchable={false}
            sortable={["label_name", "label_code", "teacher_name", "teacher_code"]}
            sortValue={{
              label_code: (row) => Number(row.label_id) || String(row.label_code),
              teacher_code: (row) => Number(row.teacher_id) || String(row.teacher_code ?? ""),
            }}
            emptyMessage={chips.length ? "No question sets match your search" : "No question sets yet"}
            emptyDescription={
              chips.length ? "Try other words or clear the filters." : "Create a question set to get started."
            }
            columns={[
              [ACTIONS_COLUMN, "Actions"],
              ["label_name", "Question set name"],
              ["label_code", "Set ID"],
              ["teacher_name", "Teacher name"],
              ["teacher_code", "Teacher ID"],
              ["status", "Status"],
            ]}
            render={{
              label_name: (row) => String(row.label_name || "Untitled set"),
              label_code: (row) => <code className="entity-code">{String(row.label_code)}</code>,
              teacher_code: (row) =>
                row.teacher_code ? <code className="entity-code">{String(row.teacher_code)}</code> : "—",
              status: (row) => <StatusBadge status={isActiveSet(row) ? 1 : 0} />,
            }}
            actions={(row) => (
              <IconActions>
                <IconButton
                  icon="view"
                  label="View question set details"
                  href={setPath(row.label_id, importFirst ? "import" : undefined)}
                />
              </IconActions>
            )}
          />
        )}
      </Card>
    </>
  );
}

function initialTab(): Tab {
  if (typeof window === "undefined") return "questions";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "manual" || tab === "import" ? tab : "questions";
}
// Everything about one question set, plus its question workspace.
export function QuestionSetDetails({ id }: { id: string }) {
  const router = useRouter();
  const [labelsRevision, setLabelsRevision] = useState(0);
  const [questionsRevision, setQuestionsRevision] = useState(0);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [importing, setImporting] = useState(false);
  const [questionMessage, setQuestionMessage] = useState("");
  const [created, setCreated] = useState(false);
  const [selectionDirty, setSelectionDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(false);
  const labels = useLoad<unknown>("/questions/labels", labelsRevision);
  const sets = rowsOf(labels.data);
  const current = sets.find((row) => String(row.label_id) === id) ?? null;
  const name = String(current?.label_name || "this question set");
  useEffect(() => {
    setCreated(new URLSearchParams(window.location.search).get("created") === "1");
  }, []);
  // Unsaved live-quiz selections are lost when the Questions view unmounts.
  const leave = () => {
    if (
      selectionDirty &&
      !confirm("Discard your unsaved live quiz selection changes?")
    )
      return false;
    setSelectionDirty(false);
    return true;
  };
  const refresh = () => setQuestionsRevision((v) => v + 1);
  const teacher = {
    teacher_id: current?.teacher_id ?? current?.created_by,
    teacher_name: current?.teacher_name,
  };

  if (labels.loading) return <Loading />;
  if (labels.error)
    return <Retry error={labels.error} onRetry={() => setLabelsRevision((v) => v + 1)} />;
  if (!current)
    return (
      <>
        <Heading title="Question set not found" />
        <Card>
          <p>This question set does not exist or is not available to your account.</p>
          <Button href="/labels">Back to question sets</Button>
        </Card>
      </>
    );

  return (
    <>
      <Heading
        title={name}
        breadcrumb={
          <Link href="/labels" onClick={(e) => !leave() && e.preventDefault()}>
            ← All question sets
          </Link>
        }
        badge={<StatusBadge status={current.status ?? 1} />}
        action={
          <div className="dashboard-actions">
            {portal.kind === "admin" && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => leave() && router.push("/labels")}
            >
              Back to list
            </Button>
          </div>
        }
      />
      {created && <Notice kind="success">Question set is ready.</Notice>}
      {edited && <Notice kind="success">Question set details updated.</Notice>}
      {editing && (
        <EditQuestionSet
          row={current}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setEdited(true);
            setLabelsRevision((v) => v + 1);
            refresh();
          }}
        />
      )}
      <Card>
        <dl className="details-grid set-summary">
          <div>
            <dt>Question set ID</dt>
            <dd>
              <code className="entity-code">{questionSetCode(current)}</code>
            </dd>
          </div>
          <div>
            <dt>Teacher</dt>
            <dd>
              {String(teacher.teacher_name || "—")}
              {teacher.teacher_id ? <small>{teacherCode(teacher)}</small> : null}
            </dd>
          </div>
          <div>
            <dt>Question bank</dt>
            <dd>{String(current.bank_name || "—")}</dd>
          </div>
          <div>
            <dt>Questions</dt>
            <dd>{String(current.question_count ?? "—")}</dd>
          </div>
        </dl>
      </Card>
      <section className="paper question-set-content" style={{ marginTop: 20 }}>
        <h2>Questions</h2>
        <div className="set-view-switch" role="group" aria-label="Question set actions">
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
              onClick={() => {
                if (value === tab || leave()) setTab(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "questions" && (
          <LiveQuestionSelection
            key={id}
            setId={id}
            setName={name}
            revision={questionsRevision}
            onDirtyChange={setSelectionDirty}
          />
        )}
        {tab === "manual" && questionMessage && (
          <Notice kind="success">{questionMessage}</Notice>
        )}
        {tab === "manual" && (
          <Form
            key={`manual-${id}-${questionsRevision}`}
            fields={questionFields.filter((field) => field.name !== "labelId")}
            submitLabel="Add to question set"
            secondaryAction={
              <button type="button" className="secondary" onClick={() => setTab("questions")}>
                View questions
              </button>
            }
            onSubmit={async (body) => {
              await api("/questions/", {
                method: "POST",
                body: { ...body, labelId: /^\d+$/.test(id) ? Number(id) : id },
              });
              setQuestionMessage("Question added to this set.");
              refresh();
            }}
          />
        )}
        {tab === "import" && (
          <BulkImport
            key={id}
            setId={id}
            setName={name}
            embedded
            onImported={refresh}
            onBusyChange={setImporting}
          />
        )}
      </section>
    </>
  );
}

function EditQuestionSet({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(String(row.label_name || ""));
  const [bank, setBank] = useState(String(row.bank_name || ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const labelName = name.trim().replace(/\s+/g, " ");
    if (labelName.length < 2 || labelName.length > 50) {
      setError("Use between 2 and 50 characters for the name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/questions/labels/${encodeURIComponent(String(row.label_id))}`, {
        method: "PUT",
        body: { labelName, bankName: bank.trim() || null },
      });
      onSaved();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  return (
    <Modal isOpen onClose={() => !busy && onClose()} title="Edit question set">
      <form onSubmit={submit}>
        {error && <Notice kind="error">{error}</Notice>}
        <div className="field">
          <label htmlFor="edit-set-name">Question set name</label>
          <input
            id="edit-set-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={50}
            required
            autoFocus
            disabled={busy}
          />
        </div>
        <div className="field">
          <label htmlFor="edit-set-bank">Question bank</label>
          <input
            id="edit-set-bank"
            value={bank}
            onChange={(event) => setBank(event.target.value)}
            maxLength={100}
            disabled={busy}
          />
        </div>
        <div className="form-actions">
          <Button type="submit" loading={busy} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
