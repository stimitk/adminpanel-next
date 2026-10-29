"use client";
import { useState } from "react";
import Link from "next/link";
import { portal } from "../lib/portal";
import { rowsOf } from "../lib/api";
import type { Row } from "../lib/types";
import {
  DataTable,
  Heading,
  Loading,
  Notice,
  Retry,
  useLoad,
  Card,
  Button,
  MetricCard,
  DeltaTrend,
  SegmentedControl,
} from "./ui";
import { Icon } from "./shell";

type Period = {
  plays: number;
  players: number;
  accuracy: number | null;
  newUsers?: number;
};
type Day = { date: string; plays: number; players: number };
type Stats = Record<string, number> & {
  period?: { days: number; from: string; to: string };
  generatedAt?: string;
  current?: Period;
  previous?: Period;
  daily?: Day[];
  topChampionships?: Row[];
  liveChampionships?: number;
  pendingTeachers?: number;
};
type Kpi = {
  key: keyof Period | "live";
  label: string;
  icon: string;
  definition: string;
  good: "up" | "neutral";
};

const PERIODS = [7, 30, 90];
const teacher = portal.kind === "teacher";
const kpis: Kpi[] = [
  {
    key: "plays",
    label: "Quiz plays",
    icon: "chart",
    good: "up",
    definition: teacher
      ? "Quiz attempts recorded in your championships during the period."
      : "Quiz attempts recorded across all championships during the period.",
  },
  {
    key: "players",
    label: "Active players",
    icon: "users",
    good: "up",
    definition:
      "Distinct players with at least one quiz play during the period.",
  },
  ...(teacher
    ? []
    : [
        {
          key: "newUsers",
          label: "New players",
          icon: "users",
          good: "up",
          definition:
            "Players whose first login falls in the period (sign-up dates are not stored). Deleted accounts excluded.",
        } as Kpi,
      ]),
  {
    key: "accuracy",
    label: "Average accuracy",
    icon: "question",
    good: "neutral",
    definition:
      "Correct answers ÷ questions answered across all plays. Change is in percentage points. Very high or low values can mean questions are too easy or too hard.",
  },
  {
    key: "live",
    label: "Live championships",
    icon: "trophy",
    good: "neutral",
    definition:
      "Active championships whose date range includes today. A current count, so no comparison.",
  },
];
const totals = teacher
  ? [
      ["championshipsCount", "championships"],
      ["questionsCount", "questions"],
      ["studentsReached", "students reached"],
      ["totalQuizzesCompleted", "quiz plays"],
    ]
  : [
      ["totalUsers", "registered users"],
      ["totalTeachers", "teachers"],
      ["totalChampionships", "championships"],
      ["totalQuestions", "questions"],
      ["totalQuizzesPlayed", "quiz plays"],
    ];

const number = (value: unknown) => Number(value || 0).toLocaleString();
const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

function initialDays() {
  if (typeof window === "undefined") return 30;
  const days = Number(new URLSearchParams(window.location.search).get("days"));
  return PERIODS.includes(days) ? days : 30;
}

function PlaysChart({ daily }: { daily: Day[] }) {
  const max = Math.max(1, ...daily.map((d) => d.plays));
  const total = daily.reduce((sum, d) => sum + d.plays, 0);
  const peak = daily.reduce((a, b) => (b.plays > a.plays ? b : a), daily[0]);
  const width = 100 / daily.length;
  return (
    <figure className="trend">
      <div className="trend-plot">
        <span className="trend-max">{number(max)}</span>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Daily quiz plays"
        >
          {daily.map((d, i) => {
            const height = (d.plays / max) * 100;
            return (
              <rect
                key={d.date}
                x={i * width + width * 0.15}
                y={100 - height}
                width={width * 0.7}
                height={height}
                className={i === daily.length - 1 ? "partial" : undefined}
              >
                <title>
                  {`${shortDate(d.date)}: ${number(d.plays)} plays, ${number(d.players)} players${i === daily.length - 1 ? " (today so far)" : ""}`}
                </title>
              </rect>
            );
          })}
        </svg>
      </div>
      <div className="trend-axis">
        <span>{shortDate(daily[0].date)}</span>
        <span>Today (so far)</span>
      </div>
      <figcaption>
        {total
          ? `${number(total)} plays over ${daily.length} days. Busiest day: ${shortDate(peak.date)} with ${number(peak.plays)}.`
          : `No quiz plays in the last ${daily.length} days.`}
      </figcaption>
    </figure>
  );
}

function TopChampionships({ rows, days }: { rows: Row[]; days: number }) {
  if (!rows.length)
    return (
      <p className="muted">
        No quiz plays in the last {days} days.{" "}
        {days < 90 && "Try a longer period."}
      </p>
    );
  const max = Math.max(...rows.map((r) => Number(r.plays)));
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Championship</th>
            <th className="num">Plays</th>
            <th className="num">Players</th>
            <th className="num">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.champ_id)}>
              <td>
                <Link
                  href={`/analytics/${encodeURIComponent(String(row.champ_id))}`}
                >
                  {String(row.champ_name || `Championship ${row.champ_id}`)}
                </Link>
                <span
                  className="inline-bar"
                  style={{ width: `${(Number(row.plays) / max) * 100}%` }}
                  aria-hidden="true"
                />
              </td>
              <td className="num">{number(row.plays)}</td>
              <td className="num">{number(row.players)}</td>
              <td className="num">
                {row.accuracy === null ? "—" : `${Number(row.accuracy)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Dashboard() {
  const [revision, setRevision] = useState(0);
  const [days, setDays] = useState(initialDays);
  const stats = useLoad<Stats>(
    `/${teacher ? "teacher" : "admin"}/dashboard-stats?days=${days}`,
    revision,
  );
  const championships = useLoad<unknown>(
    teacher ? "/teacher/championships" : "/championships/feed",
    revision,
  );
  const data = stats.data;
  const retry = () => setRevision((v) => v + 1);

  function choose(value: number) {
    setDays(value);
    window.history.replaceState(null, "", `?days=${value}`);
  }

  const updated = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  return (
    <>
      <Heading
        title="Dashboard"
        description={`${teacher ? "Your championships" : "All of kGamify"} · last ${days} days compared with the ${days} days before${updated ? ` · updated ${updated}` : ""}`}
        action={
          <div className="dashboard-actions">
            <SegmentedControl
              options={PERIODS.map((value) => ({
                value,
                label: `${value} days`,
              }))}
              value={days}
              onChange={choose}
              label="Period"
            />
            <Button href="/championships/new">Create Championship</Button>
          </div>
        }
      />
      {!teacher && !!data?.pendingTeachers && (
        <Notice kind="info">
          {number(data.pendingTeachers)}{" "}
          {data.pendingTeachers === 1 ? "teacher is" : "teachers are"} waiting
          for approval. <Link href="/teachers">Review teachers</Link>
        </Notice>
      )}
      {stats.error ? (
        <Retry error={stats.error} onRetry={retry} />
      ) : (
        <section
          className="metrics"
          aria-label="Key metrics"
          aria-busy={stats.loading}
        >
          {kpis.map((kpi) => {
            const current =
              kpi.key === "live"
                ? (data?.liveChampionships ?? null)
                : (data?.current?.[kpi.key] ?? null);
            const formattedValue =
              current === null
                ? "—"
                : kpi.key === "accuracy"
                  ? `${current}%`
                  : number(current);

            return (
              <MetricCard
                key={kpi.key}
                icon={<Icon name={kpi.icon} />}
                label={kpi.label}
                definition={kpi.definition}
                value={formattedValue}
                loading={stats.loading}
                delta={
                  kpi.key === "live" ? (
                    <small className="delta">Running today</small>
                  ) : (
                    <DeltaTrend
                      current={current}
                      previous={data?.previous?.[kpi.key] ?? null}
                      days={days}
                      good={kpi.good}
                      points={kpi.key === "accuracy"}
                    />
                  )
                }
              />
            );
          })}
        </section>
      )}
      {data && !data.current && (
        <Notice kind="info">
          Period metrics need the updated API. Showing all-time totals only.
        </Notice>
      )}
      <details className="definitions">
        <summary>How these numbers are calculated</summary>
        <dl>
          {kpis.map((kpi) => (
            <div key={kpi.key}>
              <dt>{kpi.label}</dt>
              <dd>{kpi.definition}</dd>
            </div>
          ))}
          <div>
            <dt>Period</dt>
            <dd>
              Rolling window ending now, compared with the window of the same
              length just before it. Today is incomplete, so its bar is
              lighter. Dates use the server clock.
            </dd>
          </div>
        </dl>
      </details>
      {data?.daily && (
        <div className="dashboard-grid">
          <Card>
            <div className="section-heading">
              <h2>Quiz plays per day</h2>
            </div>
            <PlaysChart daily={data.daily} />
          </Card>
          <Card>
            <div className="section-heading">
              <h2>Most played championships</h2>
              <Link href="/analytics">All analytics</Link>
            </div>
            <TopChampionships rows={data.topChampionships || []} days={days} />
          </Card>
        </div>
      )}
      {stats.loading && !data && <Loading />}
      <Card style={{ marginTop: 24 }}>
        <div className="section-heading">
          <h2>{teacher ? "Your Championships" : "Active Championships"}</h2>
          <Link href="/championships">View all</Link>
        </div>
        {championships.error ? (
          <Retry error={championships.error} onRetry={retry} />
        ) : (
          <DataTable
            rows={rowsOf(championships.data).slice(0, 8)}
            loading={championships.loading}
            columns={[
              ["champ_name", "Championship"],
              ["category_name", "Category"],
              ["start_date", "Starts"],
              ["end_date", "Ends"],
              ["status", "Status"],
            ]}
            actions={(row: Row) => (
              <Button
                size="sm"
                variant="secondary"
                href={`/championships/${encodeURIComponent(String(row.champ_id))}`}
              >
                View
              </Button>
            )}
          />
        )}
      </Card>
      {data && (
        <p className="totals muted" style={{ marginTop: 16 }}>
          All time:{" "}
          {totals
            .map(([key, label]) => `${number(data[key])} ${label}`)
            .join(" · ")}
        </p>
      )}
    </>
  );
}
