"use client";
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { api, errorText, rowsOf } from "../lib/api";
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
} from "./ui";

const ChampionshipWizard = dynamic(
  () =>
    import("./championship-wizard").then((m) => ({
      default: m.ChampionshipWizard,
    })),
  { loading: () => <Loading text="Loading championship wizard…" />, ssr: false }
);

export function Championships() {
  const [revision, setRevision] = useState(0);
  const [errorMessage, setError] = useState("");
  const [pending, setPending] = useState("");
  const { profile } = useAuth();
  const { data, loading, error } = useLoad<unknown>(
    portal.kind === "teacher"
      ? "/teacher/championships"
      : "/championships/feed",
    revision,
  );
  async function toggle(row: Row) {
    const id = String(row.champ_id);
    setPending(id);
    setError("");
    try {
      await api(`/teacher/championships/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: { status: Number(row.status) === 1 ? 0 : 1 },
      });
      setRevision((v) => v + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending("");
    }
  }
  return (
    <>
      <Heading
        title="Championships"
        description={
          portal.kind === "admin"
            ? "Active championships across kGamify."
            : "Manage the championships you have created."
        }
        action={
          <Button href="/championships/new">
            Create Championship
          </Button>
        }
      />
      {portal.kind === "admin" && (
        <Notice kind="info">
          This list shows active championships. You can edit championships
          created by your account.
        </Notice>
      )}
      {errorMessage && <Notice kind="error">{errorMessage}</Notice>}
      <Card>
        {error ? (
          <Retry error={error} onRetry={() => setRevision((v) => v + 1)} />
        ) : (
          <DataTable
            rows={rowsOf(data)}
            loading={loading}
            columns={[
              ["champ_name", "Championship"],
              ["category_name", "Category"],
              ["start_date", "Start date"],
              ["end_date", "End date"],
              ["total_participants", "Participants"],
              ["status", "Status"],
            ]}
            actions={(row) => (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  href={`/championships/${encodeURIComponent(String(row.champ_id))}`}
                >
                  View
                </Button>
                {(portal.kind === "teacher" ||
                  String(row.teacher_id) === String(profile?.id)) && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      href={`/championships/${encodeURIComponent(String(row.champ_id))}/edit`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={pending === String(row.champ_id)}
                      disabled={pending === String(row.champ_id)}
                      onClick={() => toggle(row)}
                    >
                      {Number(row.status) === 1 ? "Deactivate" : "Activate"}
                    </Button>
                  </>
                )}
              </>
            )}
          />
        )}
      </Card>
    </>
  );
}
function dateValue(value: unknown) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}
export function ChampionshipEditor({ id }: { id?: string }) {
  return id ? <ExistingChampionshipEditor id={id} /> : <ChampionshipWizard />;
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
        action={
          <Link
            className="button secondary"
            href={`/analytics/${encodeURIComponent(id)}`}
          >
            View analytics
          </Link>
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
                  ["Category", data.category_name],
                  ["Teacher", data.teacher_name],
                  [
                    "Starts",
                    `${dateValue(data.start_date)} ${data.start_time || ""}`,
                  ],
                  [
                    "Ends",
                    `${dateValue(data.end_date)} ${data.end_time || ""}`,
                  ],
                  ["Status", Number(data.status) === 1 ? "Active" : "Inactive"],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt>{String(label)}</dt>
                    <dd>{String(value || "—")}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card style={{ marginTop: 20 }}>
              <h2 style={{ margin: "0 0 16px" }}>Game Settings</h2>
              <DataTable
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
export function ChampionshipAnalytics({ id }: { id?: string }) {
  const [revision, setRevision] = useState(0);
  const list = useLoad<unknown>(
    !id
      ? portal.kind === "teacher"
        ? "/teacher/championships"
        : "/championships/feed"
      : null,
    revision,
  );
  const stats = useLoad<{
    championship: { name: string };
    analytics: Record<string, number>;
  }>(
    id && portal.kind === "teacher"
      ? `/teacher/analytics/${encodeURIComponent(id)}`
      : null,
    revision,
  );
  const results = useLoad<unknown>(
    id
      ? portal.kind === "teacher"
        ? `/teacher/championships/${encodeURIComponent(id)}/participants`
        : `/championships/${encodeURIComponent(id)}/leaderboard?limit=200`
      : null,
    revision,
  );
  return (
    <>
      <Heading
        title={stats.data?.championship?.name || "Championship Analytics"}
        description={
          id
            ? "Scores and participation for this championship."
            : "Select a championship to view its results."
        }
      />
      {!id ? (
        <Card>
          {list.error ? (
            <Retry
              error={list.error}
              onRetry={() => setRevision((v) => v + 1)}
            />
          ) : (
            <DataTable
              rows={rowsOf(list.data)}
              loading={list.loading}
              columns={[
                ["champ_name", "Championship"],
                ["category_name", "Category"],
              ]}
              actions={(row) => (
                <Button
                  size="sm"
                  variant="secondary"
                  href={`/analytics/${encodeURIComponent(String(row.champ_id))}`}
                >
                  View results
                </Button>
              )}
            />
          )}
        </Card>
      ) : (
        <>
          {stats.loading && <Loading />}
          {stats.error && (
            <Retry
              error={stats.error}
              onRetry={() => setRevision((v) => v + 1)}
            />
          )}{" "}
          {stats.data && (
            <section className="metrics">
              {Object.entries(stats.data.analytics).map(([key, value]) => (
                <div className="metric" key={key}>
                  <span>{key.replace(/([A-Z])/g, " $1")}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </section>
          )}
          <Card style={{ marginTop: 20 }}>
            <h2 style={{ margin: "0 0 16px" }}>
              {portal.kind === "teacher" ? "Participants" : "Leaderboard"}
            </h2>
            {results.error ? (
              <Retry
                error={results.error}
                onRetry={() => setRevision((v) => v + 1)}
              />
            ) : (
              <DataTable
                rows={rowsOf(results.data)}
                loading={results.loading}
                columns={
                  portal.kind === "teacher"
                    ? [
                        ["user_name", "Student"],
                        ["email", "Email"],
                        ["total_score", "Score"],
                        ["total_bonus", "Bonus"],
                        ["correct_questions", "Correct"],
                        ["total_questions", "Questions"],
                        ["time_taken", "Time"],
                      ]
                    : [
                        ["rank", "Rank"],
                        ["userName", "Student"],
                        ["score", "Score"],
                        ["bonus", "Bonus"],
                        ["correctCount", "Correct"],
                        ["totalQuestions", "Questions"],
                        ["timeTaken", "Time"],
                      ]
                }
              />
            )}
          </Card>
        </>
      )}
    </>
  );
}
