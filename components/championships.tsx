"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { api, ApiError, errorText, rowsOf } from "../lib/api";
import { championshipQuestionCounts } from "../lib/championships";
import { championshipCode } from "../lib/codes";
import { isBlocked } from "../lib/questions";
import { championshipFields } from "../lib/resources";
import { portal } from "../lib/portal";
import type { Row } from "../lib/types";
import { useAuth } from "./auth";
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
  StatusBadge,
  Badge,
  ACTIONS_COLUMN,
  IconActions,
  IconButton,
  useConfirm,
} from "./ui";

const ChampionshipWizard = dynamic(
  () =>
    import("./championship-wizard").then((m) => ({
      default: m.ChampionshipWizard,
    })),
  { loading: () => <Loading text="Loading championship wizard…" />, ssr: false }
);

// Admins manage every championship (inactive and blocked too) through
// /admin/championships. Older APIs without it fall back to the active feed.
export function useChampionshipList(revision: number) {
  const [state, setState] = useState<{
    rows: Row[];
    loading: boolean;
    error: string;
    limited: boolean;
  }>({ rows: [], loading: true, error: "", limited: false });
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    setState((previous) => ({ ...previous, loading: true, error: "" }));
    (async () => {
      if (portal.kind === "teacher")
        return { rows: rowsOf(await api("/teacher/championships", { signal })), limited: false };
      try {
        return { rows: rowsOf(await api("/admin/championships", { signal })), limited: false };
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
        return { rows: rowsOf(await api("/championships/feed", { signal })), limited: true };
      }
    })()
      .then((result) => {
        if (!signal.aborted) setState({ ...result, loading: false, error: "" });
      })
      .catch((error) => {
        if (!signal.aborted)
          setState({ rows: [], loading: false, error: errorText(error), limited: false });
      });
    return () => controller.abort();
  }, [revision]);
  return state;
}

// The schedule has ended (end date before today).
export function isCompleted(row: Row) {
  const end = typeof row.end_date === "string" ? row.end_date.slice(0, 10) : "";
  return !!end && end < new Date().toISOString().slice(0, 10);
}
function ChampionshipStatus({ row }: { row: Row }) {
  return (
    <div className="status-stack">
      <StatusBadge status={row.status} />
      {isBlocked(row) && <Badge variant="suspended">Blocked</Badge>}
      {isCompleted(row) && <Badge variant="info">Completed</Badge>}
    </div>
  );
}
const STATUS_FILTERS: [string, string, (row: Row) => boolean][] = [
  ["", "All statuses", () => true],
  ["active", "Active", (r) => Number(r.status) === 1 && !isBlocked(r)],
  ["inactive", "Inactive", (r) => Number(r.status) !== 1],
  ["blocked", "Blocked", isBlocked],
  ["completed", "Completed", isCompleted],
];

function QuestionCount({ row, kind }: { row: Row; kind: "total" | "display" }) {
  const counts = championshipQuestionCounts(row);
  if (kind === "total") return <>{counts.total ?? "—"}</>;
  if (counts.display === null || counts.perGame === null) return <>—</>;
  const short = counts.display < counts.perGame;
  return (
    <span className={`question-count${short ? " is-short" : ""}`}>
      <strong>{counts.display}</strong>
      {short && <small>{`Needs ${counts.perGame} · only ${counts.display} usable`}</small>}
    </span>
  );
}

// Date with its time underneath, e.g. "01 Oct 2026" over "09:00 AM".
function DateTime({ date, time }: { date: unknown; time: unknown }) {
  const day = dateValue(date);
  if (!day) return <>—</>;
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = String(time || "").split(":").map(Number);
  const shown = new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const clockTime = Number.isFinite(h) && time
    ? new Date(2000, 0, 1, h, min || 0).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  return (
    <span className="date-time">
      {Number.isFinite(y) && m && d ? shown : day}
      {clockTime && <small>{clockTime}</small>}
    </span>
  );
}

export function Championships() {
  const admin = portal.kind === "admin";
  const [revision, setRevision] = useState(0);
  const [errorMessage, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { profile } = useAuth();
  const { confirm, dialog } = useConfirm();
  const list = useChampionshipList(revision);
  const adminControls = admin && !list.limited;
  const matchesStatus =
    STATUS_FILTERS.find(([value]) => value === statusFilter)?.[2] ?? (() => true);
  const rows = list.rows.filter(matchesStatus).map((row) => ({
    ...row,
    champ_code: championshipCode(row),
    total_questions: championshipQuestionCounts(row).total,
    questions_to_display: championshipQuestionCounts(row).display,
  }));
  async function run(row: Row, path: string, body: Row, done: string) {
    const id = String(row.champ_id);
    setPending(id);
    setError("");
    setMessage("");
    try {
      await api(path, { method: "PATCH", body });
      setMessage(done);
      setRevision((v) => v + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending("");
    }
  }
  async function toggle(row: Row) {
    const id = encodeURIComponent(String(row.champ_id));
    const status = Number(row.status) === 1 ? 0 : 1;
    const name = String(row.champ_name);
    if (
      !(await confirm({
        title: status ? "Activate championship?" : "Deactivate championship?",
        message: status
          ? `“${name}” will become available to players during its scheduled dates.`
          : `“${name}” will be hidden from players until it is activated again. Results already recorded are kept.`,
        confirmLabel: status ? "Activate" : "Deactivate",
        isDangerous: !status,
      }))
    )
      return;
    const own = portal.kind === "teacher" || String(row.teacher_id) === String(profile?.id);
    return run(
      row,
      adminControls && !own
        ? `/admin/championships/${id}/status`
        : `/teacher/championships/${id}/status`,
      { status },
      `“${String(row.champ_name)}” is now ${status ? "active" : "inactive"}.`,
    );
  }
  async function block(row: Row) {
    const blocked = !isBlocked(row);
    const name = String(row.champ_name);
    if (
      !(await confirm({
        title: blocked ? "Block championship?" : "Unblock championship?",
        message: blocked
          ? `Players will not be able to open or join “${name}” until it is unblocked. Championship Makers cannot activate it while it is blocked.`
          : `“${name}” can be opened and joined again if it is active.`,
        confirmLabel: blocked ? "Block" : "Unblock",
        isDangerous: blocked,
      }))
    )
      return;
    return run(
      row,
      `/admin/championships/${encodeURIComponent(String(row.champ_id))}/block`,
      { blocked },
      `“${String(row.champ_name)}” is ${blocked ? "blocked" : "unblocked"}.`,
    );
  }
  return (
    <>
      <Heading
        title="Championships"
        action={
          <Button href="/championships/new">
            Create Championship
          </Button>
        }
      />
      {admin && list.limited && (
        <Notice kind="info">
          This list shows active championships only, and admin controls are
          unavailable, because the service does not provide championship
          management for admins yet. You can edit championships created by
          your account.
        </Notice>
      )}
      {errorMessage && <Notice kind="error">{errorMessage}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}
      <Card>
        {list.error ? (
          <Retry error={list.error} onRetry={() => setRevision((v) => v + 1)} />
        ) : (
          <DataTable
            rows={rows}
            loading={list.loading}
            serial
            searchPlaceholder="Name, ID or category"
            sortable={[
              "champ_code",
              "champ_name",
              "total_questions",
              "questions_to_display",
              "start_date",
              "end_date",
            ]}
            sortValue={{ champ_code: (row) => Number(row.champ_id) || String(row.champ_code) }}
            toolbar={
              <label>
                Status
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {STATUS_FILTERS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            }
            emptyMessage={statusFilter ? "No championships with this status" : undefined}
            emptyDescription={statusFilter ? "Choose another status to see more championships." : undefined}
            rowClassName={(row) => (isBlocked(row) ? "is-blocked" : undefined)}
            render={{
              status: (row) => <ChampionshipStatus row={row} />,
              champ_name: (row) => String(row.champ_name || "Untitled championship"),
              champ_code: (row) => <code className="entity-code">{String(row.champ_code)}</code>,
              start_date: (row) => <DateTime date={row.start_date} time={row.start_time} />,
              end_date: (row) => <DateTime date={row.end_date} time={row.end_time} />,
              total_questions: (row) => <QuestionCount row={row} kind="total" />,
              questions_to_display: (row) => (
                <QuestionCount row={row} kind="display" />
              ),
            }}
            columns={[
              ["status", "Status"],
              [ACTIONS_COLUMN, "Actions"],
              ["champ_name", "Championship name"],
              ["champ_code", "Championship ID"],
              ["total_questions", "No. of questions"],
              ["questions_to_display", "Questions to display"],
              ["start_date", "Start date"],
              ["end_date", "End date"],
            ]}
            actions={(row) => {
              const id = String(row.champ_id);
              const own =
                portal.kind === "teacher" ||
                String(row.teacher_id) === String(profile?.id);
              const busy = pending === id;
              const blocked = isBlocked(row);
              const activeNow = Number(row.status) === 1;
              const path = encodeURIComponent(id);
              return (
                <IconActions>
                  <IconButton
                    icon="view"
                    label="View championship details"
                    href={`/championships/${path}`}
                  />
                  {(own || adminControls) && (
                    <IconButton
                      icon="edit"
                      label="Edit championship"
                      disabled={busy}
                      href={`/championships/${path}/edit`}
                    />
                  )}
                  {(own || adminControls) && (
                    <IconButton
                      icon={activeNow ? "deactivate" : "activate"}
                      label={activeNow ? "Deactivate championship" : "Activate championship"}
                      tone={activeNow ? "warning" : "success"}
                      loading={busy}
                      disabled={busy || (blocked && !adminControls)}
                      disabledReason={blocked && !adminControls ? "Blocked by an admin" : undefined}
                      onClick={() => toggle(row)}
                    />
                  )}
                  {adminControls && (
                    <IconButton
                      icon={blocked ? "unblock" : "block"}
                      label={blocked ? "Unblock championship" : "Block championship"}
                      tone={blocked ? "default" : "danger"}
                      disabled={busy}
                      onClick={() => block(row)}
                    />
                  )}
                </IconActions>
              );
            }}
          />
        )}
      </Card>
      {dialog}
    </>
  );
}

function dateValue(value: unknown) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}
export function ChampionshipEditor({ id }: { id?: string }) {
  if (!id) return <ChampionshipWizard />;
  return portal.kind === "admin" ? (
    <AdminChampionshipEditor id={id} />
  ) : (
    <ExistingChampionshipEditor id={id} />
  );
}
function ExistingChampionshipEditor({ id }: { id: string }) {
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const { data, loading, error } = useLoad<Row>(
    id ? `/championships/${encodeURIComponent(id)}` : null,
    revision,
  );
  // The documented PUT updates championship metadata only; it does not update mode rows.
  const fields = id
    ? championshipFields.filter((f) =>
        [
          "champName",
          "categoryId",
          "startDate",
          "startTime",
          "endDate",
          "endTime",
        ].includes(f.name),
      )
    : championshipFields;
  const initial = data
    ? {
        champName: data.champ_name,
        categoryId: data.category_id,
        startDate: dateValue(data.start_date),
        endDate: dateValue(data.end_date),
        startTime: data.start_time,
        endTime: data.end_time,
      }
    : {};
  return (
    <>
      <Heading
        title={id ? "Edit Championship" : "Create New Championship"}
        description="Configure your championship and its game settings together."
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <Retry error={error} onRetry={() => setRevision((v) => v + 1)} />
      ) : (
        <section className="paper">
          {id && (
            <Notice kind="info">
              You can update the championship name, category, and schedule.
              Editing existing game settings is not available yet.
            </Notice>
          )}
          <Form
            key={id || "new"}
            fields={fields}
            initial={initial}
            submitLabel={id ? "Save championship" : "Create championship"}
            onSubmit={async (values) => {
              const start = `${values.startDate}T${values.startTime}`;
              const end = `${values.endDate}T${values.endTime}`;
              if (end <= start)
                throw new Error(
                  "The end date and time must be after the start.",
                );
              const payload: Row = {
                champName: values.champName,
                categoryId: values.categoryId,
                startDate: values.startDate,
                endDate: values.endDate,
                startTime: values.startTime,
                endTime: values.endTime,
              };
              if (!id) {
                const minutes = Number(values.durationMinutes);
                payload.modes = [
                  {
                    modeName: values.modeName,
                    description: values.description || "",
                    noOfQuestions: values.noOfQuestions,
                    timeMinutes: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`,
                    labelIds: values.labelIds || [],
                  },
                ];
              }
              await api(
                id
                  ? `/teacher/championships/${encodeURIComponent(id)}`
                  : "/teacher/championships",
                { method: id ? "PUT" : "POST", body: payload },
              );
              router.push("/championships");
            }}
          />
        </section>
      )}
    </>
  );
}
export function ChampionshipDetails({ id }: { id: string }) {
  const [revision, setRevision] = useState(0);
  const { data, loading, error } = useLoad<Row>(
    `/championships/${encodeURIComponent(id)}`,
    revision,
  );
  return (
    <>
      <Heading
        title={String(data?.champ_name || "Championship")}
        breadcrumb={<Link href="/championships">← All championships</Link>}
        action={
          <div className="dashboard-actions">
            <Button
              variant="secondary"
              href={`/analytics?championshipId=${encodeURIComponent(id)}`}
            >
              View analytics
            </Button>
            <Button href={`/leaderboard/${encodeURIComponent(id)}`}>
              View leaderboard
            </Button>
          </div>
        }
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <Retry error={error} onRetry={() => setRevision((v) => v + 1)} />
      ) : (
        data && (
          <>
            <Card>
              <dl className="details-list">
                {[
                  ["Championship ID", championshipCode(data)],
                  ["Category", data.category_name],
                  ["Championship Maker", data.teacher_name],
                  [
                    "Starts",
                    `${dateValue(data.start_date)} ${data.start_time || ""}`,
                  ],
                  [
                    "Ends",
                    `${dateValue(data.end_date)} ${data.end_time || ""}`,
                  ],
                  ["Status", Number(data.status) === 1 ? "Active" : "Inactive"],
                  [
                    "Access",
                    isBlocked(data)
                      ? "Blocked by an admin · players cannot open or join"
                      : "Not blocked",
                  ],
                  ["Total questions", championshipQuestionCounts(data).total],
                  [
                    "Questions to display",
                    championshipQuestionCounts(data).display,
                  ],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt>{String(label)}</dt>
                    <dd>{String(value ?? "") || "—"}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card style={{ marginTop: 20 }}>
              <h2 style={{ margin: "0 0 16px" }}>Game Settings</h2>
              <DataTable
                searchable={false}
                rows={rowsOf(data.modes)}
                columns={[
                  ["mode_name", "Game mode"],
                  ["description", "Description"],
                  ["no_of_question", "Questions"],
                  ["time_minutes", "Duration"],
                ]}
              />
            </Card>
          </>
        )
      )}
    </>
  );
}

const minutesOf = (value: unknown) => {
  const [h = 0, m = 0] = String(value || "").split(":").map(Number);
  return String(h * 60 + m || "");
};
const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;

// Admins edit every championship field from the Edit action in the list.
function AdminChampionshipEditor({ id }: { id: string }) {
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const { data, loading, error } = useLoad<Row>(
    `/championships/${encodeURIComponent(id)}`,
    revision,
  );
  return (
    <>
      <Heading
        title="Edit Championship"
        breadcrumb={<Link href="/championships">← All championships</Link>}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <Retry error={error} onRetry={() => setRevision((v) => v + 1)} />
      ) : (
        data && (
          <AdminChampionshipForm
            row={data}
            onSaved={() => router.push("/championships")}
          />
        )
      )}
    </>
  );
}
function AdminChampionshipForm({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const modes = rowsOf(row.modes);
  const base = championshipFields.filter((f) =>
    ["champName", "categoryId", "startDate", "startTime", "endDate", "endTime", "labelIds"].includes(f.name),
  );
  const modeFields = modes.flatMap((_, i) => {
    const suffix = modes.length > 1 ? ` (${i + 1})` : "";
    return [
      { name: `mode${i}Name`, label: `Game mode${suffix}`, required: true, maxLength: 100 },
      { name: `mode${i}Questions`, label: `Number of questions${suffix}`, type: "number" as const, required: true, min: 1, max: 100 },
      { name: `mode${i}Duration`, label: `Duration (minutes)${suffix}`, type: "number" as const, required: true, min: 1, max: 1439 },
      { name: `mode${i}Description`, label: `Game description${suffix}`, type: "textarea" as const },
    ];
  });
  const initial: Record<string, unknown> = {
    champName: row.champ_name,
    categoryId: row.category_id,
    startDate: dateValue(row.start_date),
    endDate: dateValue(row.end_date),
    startTime: row.start_time,
    endTime: row.end_time,
    labelIds: Array.isArray(row.label_ids) ? row.label_ids : [],
  };
  modes.forEach((mode, i) => {
    initial[`mode${i}Name`] = mode.mode_name;
    initial[`mode${i}Questions`] = mode.no_of_question;
    initial[`mode${i}Duration`] = minutesOf(mode.time_minutes);
    initial[`mode${i}Description`] = mode.description;
  });
  return (
    <Card>
      <Form
        fields={[...base, ...modeFields]}
        initial={initial}
        submitLabel="Save changes"
        secondaryAction={
          <Link className="button secondary" href="/championships">
            Cancel
          </Link>
        }
        onSubmit={async (values) => {
          const start = `${values.startDate}T${values.startTime}`;
          const end = `${values.endDate}T${values.endTime}`;
          if (end <= start) throw new Error("The end date and time must be after the start.");
          await api(`/admin/championships/${encodeURIComponent(String(row.champ_id))}`, {
            method: "PUT",
            body: {
              champName: String(values.champName).replace(/\s+/g, " "),
              categoryId: values.categoryId,
              startDate: values.startDate,
              endDate: values.endDate,
              startTime: values.startTime,
              endTime: values.endTime,
              labelIds: values.labelIds || [],
              modes: modes.map((mode, i) => ({
                modeId: mode.mode_id,
                modeName: values[`mode${i}Name`],
                description: values[`mode${i}Description`] || "",
                noOfQuestions: values[`mode${i}Questions`],
                timeMinutes: clock(Number(values[`mode${i}Duration`])),
              })),
            },
          });
          onSaved();
        }}
      />
    </Card>
  );
}
