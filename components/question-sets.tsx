"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, rowsOf } from "../lib/api";
import { championshipCode, questionSetCode, teacherCode } from "../lib/codes";
import { isBlocked } from "../lib/questions";
import { questionFields } from "../lib/resources";
import type { Row } from "../lib/types";
import dynamic from "next/dynamic";
import { useChampionshipList } from "./championships";
import { LiveQuestionSelection } from "./live-question-selection";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Form,
  Heading,
  IconActions,
  IconButton,
  Loading,
  Notice,
  Retry,
  StatusBadge,
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

type Tab = "questions" | "manual" | "import";
const setPath = (id: unknown, tab?: Tab) =>
  `/labels/${encodeURIComponent(String(id))}${tab && tab !== "questions" ? `?tab=${tab}` : ""}`;

// Main listing: serial number, name and a View action, nothing more.
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
  const labels = useLoad<unknown>("/questions/labels", revision);
  const sets = rowsOf(labels.data);
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
        description="Open a set to see its details, linked championships and questions."
        action={<Button onClick={() => setCreating(true)}>New question set</Button>}
      />
      {importFirst && (
        <Notice kind="info">
          Choose the question set to import into, then select View. The set
          opens on its import tab.
        </Notice>
      )}
      <Card>
        {labels.error ? (
          <Retry error={labels.error} onRetry={() => setRevision((v) => v + 1)} />
        ) : (
          <DataTable
            rows={sets}
            loading={labels.loading}
            serial
            searchPlaceholder="Search question sets"
            sortable={["label_name"]}
            emptyMessage="No question sets yet"
            emptyDescription="Create a question set to get started."
            columns={[["label_name", "Question set name"]]}
            render={{
              label_name: (row) => (
                <Link className="table-link" href={setPath(row.label_id, importFirst ? "import" : undefined)}>
                  {String(row.label_name || "Untitled set")}
                </Link>
              ),
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
const championshipLabelIds = (c: Row) =>
  [
    ...((Array.isArray(c.label_ids) ? c.label_ids : []) as unknown[]).map(String),
    ...rowsOf(c.modes).flatMap((m) => ((m.label_ids || m.labelIds || []) as unknown[]).map(String)),
  ];

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
  const labels = useLoad<unknown>("/questions/labels", labelsRevision);
  const championships = useChampionshipList(labelsRevision);
  const sets = rowsOf(labels.data);
  const index = sets.findIndex((row) => String(row.label_id) === id);
  const current = index >= 0 ? sets[index] : null;
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
  const linked = championships.rows.filter((c) => championshipLabelIds(c).includes(id));
  const teacher = {
    teacher_id: current?.teacher_id ?? current?.created_by,
    teacher_name: current?.teacher_name,
  };
  // One row per linked championship; a set without one still gets a row.
  const associations: Row[] = (linked.length ? linked : [null]).map((c) => ({
    association_id: c ? String(c.champ_id) : "none",
    label_code: current ? questionSetCode(current) : "—",
    label_name: current?.label_name,
    teacher_code: teacher.teacher_id ? teacherCode(teacher) : null,
    teacher_name: teacher.teacher_name,
    champ_id: c?.champ_id,
    champ_code: c ? championshipCode(c) : null,
    champ_name: c?.champ_name ?? "Not linked to a championship",
    status: c?.status,
    blocked: c ? isBlocked(c) : false,
  }));

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
          <Button
            variant="secondary"
            onClick={() => leave() && router.push("/labels")}
          >
            Back to list
          </Button>
        }
      />
      {created && <Notice kind="success">Question set is ready.</Notice>}
      <Card>
        <dl className="details-grid">
          {[
            ["Serial number", index + 1],
            ["Question set ID", questionSetCode(current)],
            ["Question set name", current.label_name],
            ["Teacher ID", teacher.teacher_id ? teacherCode(teacher) : "—"],
            ["Teacher name", teacher.teacher_name || "—"],
            ["Question bank", current.bank_name || "—"],
            ["Questions", current.question_count ?? "—"],
            ["Linked championships", championships.loading ? "…" : linked.length],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt>{String(label)}</dt>
              <dd>{String(value ?? "—")}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card style={{ marginTop: 20 }}>
        <div className="section-heading">
          <h2>Associated championships</h2>
        </div>
        {championships.error ? (
          <Retry error={championships.error} onRetry={() => setLabelsRevision((v) => v + 1)} />
        ) : (
          <DataTable
            rows={associations}
            loading={championships.loading}
            serial
            searchable={false}
            rowKey={(row) => String(row.association_id)}
            columns={[
              ["label_code", "Question set ID"],
              ["label_name", "Question set name"],
              ["teacher_code", "Teacher ID"],
              ["teacher_name", "Teacher name"],
              ["champ_code", "Championship ID"],
              ["champ_name", "Championship name"],
              ["status", "Status"],
            ]}
            render={{
              label_code: (row) => <code className="entity-code">{String(row.label_code)}</code>,
              teacher_code: (row) =>
                row.teacher_code ? <code className="entity-code">{String(row.teacher_code)}</code> : "—",
              champ_code: (row) =>
                row.champ_code ? <code className="entity-code">{String(row.champ_code)}</code> : "—",
              status: (row) =>
                row.champ_id === undefined ? (
                  <Badge variant="neutral">Unassigned</Badge>
                ) : (
                  <div className="status-stack">
                    <StatusBadge status={row.status} />
                    {Boolean(row.blocked) && <Badge variant="suspended">Blocked</Badge>}
                  </div>
                ),
            }}
            actions={(row) =>
              row.champ_id === undefined ? (
                <span className="muted">—</span>
              ) : (
                <IconActions>
                  <IconButton
                    icon="view"
                    label="View championship"
                    href={`/championships/${encodeURIComponent(String(row.champ_id))}`}
                  />
                  <IconButton
                    icon="leaderboard"
                    label="View leaderboard for this set"
                    href={`/leaderboard/${encodeURIComponent(String(row.champ_id))}?labelId=${encodeURIComponent(id)}`}
                  />
                </IconActions>
              )
            }
          />
        )}
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
