"use client";
import { useEffect, useMemo, useState } from "react";
import { rowsOf } from "../lib/api";
import { championshipCode, questionSetCode, teacherCode } from "../lib/codes";
import {
  formatDuration,
  percent,
  summarize,
  type PerformanceRow,
} from "../lib/performance";
import { portal } from "../lib/portal";
import type { Row } from "../lib/types";
import { BarList, ColumnChart, StackedBarList } from "./charts";
import { useChampionshipList } from "./championships";
import { loadQuestionSets, loadTeachers } from "./pickers";
import { Icon } from "./shell";
import {
  Button,
  Card,
  DataTable,
  EntityPicker,
  Heading,
  IconActions,
  IconButton,
  MetricCard,
  Notice,
  Retry,
  useLoad,
  type PickerOption,
} from "./ui";

type Performance = { rows: PerformanceRow[]; daily: { date: string; participants: number }[] };
type Filters = {
  championshipId: string;
  categoryId: string;
  set: PickerOption | null;
  teacher: PickerOption | null;
  from: string;
  to: string;
};
const EMPTY: Filters = { championshipId: "", categoryId: "", set: null, teacher: null, from: "", to: "" };
const teacherPortal = portal.kind === "teacher";
const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function initialFilters(): Filters {
  if (typeof window === "undefined") return EMPTY;
  const params = new URLSearchParams(window.location.search);
  return { ...EMPTY, championshipId: params.get("championshipId") || "" };
}

// Groups performance rows by a key and re-derives the weighted totals.
function groupBy(rows: PerformanceRow[], key: string) {
  const groups = new Map<string, PerformanceRow[]>();
  for (const row of rows) {
    const id = String(row[key]);
    groups.set(id, [...(groups.get(id) || []), row]);
  }
  return [...groups.entries()].map(([id, list]) => ({ id, first: list[0], ...summarize(list) }));
}

export function AnalyticsDashboard() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [revision, setRevision] = useState(0);
  const championships = useChampionshipList(0);
  const categories = useLoad<unknown>("/questions/categories");
  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const dateError = filters.from && filters.to && filters.from > filters.to;
  const query = new URLSearchParams({
    ...(filters.championshipId ? { championshipId: filters.championshipId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.set ? { labelId: filters.set.value } : {}),
    ...(filters.teacher ? { teacherId: filters.teacher.value } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  });
  const performance = useLoad<Performance>(
    dateError ? null : `/${teacherPortal ? "teacher" : "admin"}/analytics/performance?${query}`,
    revision,
  );
  // Keep the shareable URL in step with the championship filter.
  useEffect(() => {
    const url = filters.championshipId ? `?championshipId=${filters.championshipId}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [filters.championshipId]);

  const rows = useMemo(
    () =>
      (performance.data?.rows || []).map((row) => {
        const accuracy = Number(row.attempted) ? (Number(row.correct) / Number(row.attempted)) * 100 : 0;
        return {
          ...row,
          champ_code: championshipCode(row),
          label_code: questionSetCode(row),
          teacher_code: teacherCode(row),
          accuracy,
        };
      }),
    [performance.data],
  );
  const totals = summarize(rows);
  const byChampionship = groupBy(rows, "champ_id").sort((a, b) => b.accuracy - a.accuracy);
  const bySet = groupBy(rows, "label_id")
    .sort((a, b) => b.attempted - a.attempted)
    .slice(0, 8);
  const daily = performance.data?.daily || [];
  const activeFilters = Object.entries(filters).filter(([, v]) => v).length;
  const notSupported = performance.error && /404|not found|unavailable/i.test(performance.error);

  const kpis = [
    { label: "Total participants", icon: "users", value: totals.participants.toLocaleString(), definition: "Plays recorded for the selected championships and question sets." },
    { label: "Questions attempted", icon: "question", value: totals.attempted.toLocaleString(), definition: `${totals.correct.toLocaleString()} correct · ${totals.incorrect.toLocaleString()} incorrect` },
    { label: "Accuracy", icon: "chart", value: percent(totals.accuracy), definition: "Correct answers ÷ questions attempted." },
    { label: "Average score", icon: "trophy", value: `${totals.avgScore.toFixed(1)}`, definition: `Average marks per participant (${percent(totals.avgScorePercent)} of total marks).` },
    { label: "Avg completion time", icon: "dashboard", value: formatDuration(totals.avgTime), definition: "Average time a participant spent per play." },
    { label: "Completion rate", icon: "file", value: percent(totals.completionRate), definition: "Share of plays where every question was answered." },
  ];

  return (
    <>
      <Heading
        title="Championship Analytics"
        description="Performance across championships and question sets. Filters update every card, chart and the table."
        action={<Button variant="secondary" href="/leaderboard">Open leaderboards</Button>}
      />
      <Card className="analytics-filters">
        <div className="filter-grid">
          <label>
            Championship
            <select value={filters.championshipId} onChange={(e) => update({ championshipId: e.target.value })}>
              <option value="">All championships</option>
              {championships.rows.map((c) => (
                <option key={String(c.champ_id)} value={String(c.champ_id)}>
                  {String(c.champ_name)} ({championshipCode(c)})
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select value={filters.categoryId} onChange={(e) => update({ categoryId: e.target.value })}>
              <option value="">All categories</option>
              {rowsOf(categories.data).map((c) => (
                <option key={String(c.category_id)} value={String(c.category_id)}>
                  {String(c.category_name)}
                </option>
              ))}
            </select>
          </label>
          <EntityPicker label="Question set" placeholder="Set name or ID" value={filters.set} onChange={(set) => update({ set })} load={loadQuestionSets} />
          {!teacherPortal && (
            <EntityPicker label="Teacher" placeholder="Name or teacher ID" value={filters.teacher} onChange={(teacher) => update({ teacher })} load={loadTeachers} />
          )}
          <label>
            From
            <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value })} />
          </label>
          <label>
            To
            <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value })} />
          </label>
        </div>
        <div className="filter-footer">
          <span className="muted" role="status">
            {activeFilters ? `${activeFilters} ${activeFilters === 1 ? "filter" : "filters"} applied` : "Showing all data"}
          </span>
          {activeFilters > 0 && (
            <Button size="sm" variant="text" onClick={() => setFilters(EMPTY)}>
              Reset filters
            </Button>
          )}
        </div>
        {dateError && <Notice kind="error">The start date must be on or before the end date.</Notice>}
      </Card>

      {notSupported ? (
        <Notice kind="info">
          Consolidated analytics need the <code>/analytics/performance</code> endpoint, which this service does not provide yet. Open a championship’s leaderboard for its results.
        </Notice>
      ) : performance.error ? (
        <Retry error={performance.error} onRetry={() => setRevision((v) => v + 1)} />
      ) : (
        <>
          <section className="metrics analytics-metrics" aria-label="Key metrics" aria-busy={performance.loading}>
            {kpis.map((kpi) => (
              <MetricCard
                key={kpi.label}
                icon={<Icon name={kpi.icon} />}
                label={kpi.label}
                value={kpi.value}
                definition={kpi.definition}
                loading={performance.loading}
                delta={<small className="delta">{kpi.definition}</small>}
              />
            ))}
          </section>
          <div className="analytics-grid">
            <Card>
              <div className="section-heading">
                <h2>Accuracy by championship</h2>
              </div>
              <BarList
                bars={byChampionship.slice(0, 10).map((g) => ({
                  key: g.id,
                  label: String(g.first.champ_name),
                  detail: `${championshipCode(g.first)} · ${g.participants.toLocaleString()} participants`,
                  value: g.accuracy,
                  tooltip: `${g.first.champ_name}: ${percent(g.accuracy)} accuracy · ${g.correct.toLocaleString()} of ${g.attempted.toLocaleString()} correct`,
                  onClick: filters.championshipId ? undefined : () => update({ championshipId: g.id }),
                }))}
                max={100}
                format={(v) => percent(v)}
              />
              {byChampionship.length > 10 && (
                <p className="muted chart-note">Top 10 of {byChampionship.length}. See the table for all.</p>
              )}
            </Card>
            <Card>
              <div className="section-heading">
                <h2>Answers by question set</h2>
              </div>
              <StackedBarList
                series={["Correct", "Incorrect"]}
                bars={bySet.map((g) => ({
                  key: g.id,
                  label: String(g.first.label_name),
                  detail: `${questionSetCode(g.first)} · ${g.first.teacher_name} (${teacherCode(g.first)})`,
                  segments: [
                    { value: g.correct, tooltip: `${g.first.label_name}: ${g.correct.toLocaleString()} correct (${percent(g.accuracy)})` },
                    { value: g.incorrect, tooltip: `${g.first.label_name}: ${g.incorrect.toLocaleString()} incorrect (${percent(100 - g.accuracy)})` },
                  ],
                }))}
                total={(bar) => percent(bySet.find((g) => g.id === bar.key)?.accuracy ?? 0)}
              />
              {bySet.length > 0 && <p className="muted chart-note">Eight most-attempted sets. Value shows accuracy.</p>}
            </Card>
          </div>
          <Card style={{ marginTop: 20 }}>
            <div className="section-heading">
              <h2>Participation over time</h2>
              {daily.length > 0 && (
                <span className="muted">
                  {shortDate(daily[0].date)} – {shortDate(daily[daily.length - 1].date)}
                </span>
              )}
            </div>
            <ColumnChart
              label="Participants per day"
              points={daily.map((d) => ({
                key: d.date,
                value: d.participants,
                tooltip: `${shortDate(d.date)}: ${d.participants.toLocaleString()} participants`,
              }))}
            />
          </Card>
          <Card style={{ marginTop: 20 }}>
            <div className="section-heading">
              <h2>Detailed performance</h2>
              <span className="muted">One row per championship and question set</span>
            </div>
            <DataTable
              rows={rows}
              loading={performance.loading}
              serial
              sortable
              defaultSort={{ key: "participants", dir: "desc" }}
              searchPlaceholder="Championship, set or teacher"
              rowKey={(row) => `${row.champ_id}:${row.label_id}`}
              sortValue={{
                champ_code: (row) => Number(row.champ_id),
                label_code: (row) => Number(row.label_id),
                teacher_code: (row) => Number(row.teacher_id),
              }}
              emptyMessage="No results for these filters"
              emptyDescription="Widen the date range or reset the filters."
              columns={[
                ["champ_name", "Championship"],
                ["champ_code", "Championship ID"],
                ["category_name", "Category"],
                ["label_name", "Question set"],
                ["label_code", "Question set ID"],
                ["teacher_name", "Teacher"],
                ["teacher_code", "Teacher ID"],
                ["participants", "Participants"],
                ["total_questions", "Total questions"],
                ["attempted", "Attempted"],
                ["correct", "Correct"],
                ["incorrect", "Incorrect"],
                ["accuracy", "Accuracy"],
                ["avg_score", "Avg score"],
                ["total_marks", "Total marks"],
                ["avg_time_sec", "Avg time"],
                ["completion_rate", "Completion"],
              ]}
              render={{
                champ_code: (row) => <code className="entity-code">{String(row.champ_code)}</code>,
                label_code: (row) => <code className="entity-code">{String(row.label_code)}</code>,
                teacher_code: (row) => <code className="entity-code">{String(row.teacher_code)}</code>,
                participants: (row) => Number(row.participants).toLocaleString(),
                attempted: (row) => Number(row.attempted).toLocaleString(),
                correct: (row) => Number(row.correct).toLocaleString(),
                incorrect: (row) => Number(row.incorrect).toLocaleString(),
                accuracy: (row) => percent(Number(row.accuracy)),
                avg_score: (row) => Number(row.avg_score).toFixed(1),
                avg_time_sec: (row) => formatDuration(row.avg_time_sec),
                completion_rate: (row) => percent(Number(row.completion_rate)),
              }}
              actions={(row: Row) => (
                <IconActions>
                  <IconButton
                    icon="leaderboard"
                    label="View leaderboard for this set"
                    href={`/leaderboard/${encodeURIComponent(String(row.champ_id))}?labelId=${encodeURIComponent(String(row.label_id))}`}
                  />
                </IconActions>
              )}
            />
          </Card>
        </>
      )}
    </>
  );
}
