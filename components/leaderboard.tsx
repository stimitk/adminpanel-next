"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { rowsOf } from "../lib/api";
import { championshipCode, participantCode, questionSetCode, teacherCode } from "../lib/codes";
import {
  PASS_PERCENT,
  formatDateTime,
  formatDuration,
  normalizeAttempt,
  percent,
  rankAttempts,
  type Attempt,
} from "../lib/performance";
import { portal } from "../lib/portal";
import { matchesSearch } from "../lib/search";
import type { Row } from "../lib/types";
import { useChampionshipList } from "./championships";
import { Icon } from "./shell";
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  Heading,
  IconActions,
  IconButton,
  Loading,
  MetricCard,
  Notice,
  Retry,
  useLoad,
  type BadgeVariant,
} from "./ui";

const teacherPortal = portal.kind === "teacher";
const RANK_LIMITS = [
  ["", "All ranks"],
  ["3", "Top 3"],
  ["10", "Top 10"],
  ["25", "Top 25"],
  ["50", "Top 50"],
  ["100", "Top 100"],
] as const;
const RESULTS = ["Passed", "Failed", "Incomplete"] as const;
const resultVariant: Record<string, BadgeVariant> = {
  Passed: "active",
  Failed: "suspended",
  Incomplete: "pending",
};
type Filters = {
  labelId: string;
  teacherId: string;
  from: string;
  to: string;
  participant: string;
  rank: string;
  result: string;
};
const EMPTY: Filters = { labelId: "", teacherId: "", from: "", to: "", participant: "", rank: "", result: "" };

function initialFilters(): Filters {
  if (typeof window === "undefined") return EMPTY;
  return { ...EMPTY, labelId: new URLSearchParams(window.location.search).get("labelId") || "" };
}
const distinct = (rows: Attempt[], id: keyof Attempt, name: keyof Attempt) =>
  [...new Map(rows.filter((r) => r[id]).map((r) => [String(r[id]), String(r[name])])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );

export function ResultBadge({ result }: { result: string }) {
  return <Badge variant={resultVariant[result] || "neutral"}>{result}</Badge>;
}
function RankBadge({ rank }: { rank: number }) {
  return <span className={`rank-badge${rank <= 3 ? ` rank-${rank}` : ""}`}>{rank || "—"}</span>;
}

export function Leaderboard({ championshipId }: { championshipId?: string }) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [revision, setRevision] = useState(0);
  const [viewing, setViewing] = useState<Attempt | null>(null);
  const championships = useChampionshipList(0);
  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const selectedId =
    championshipId ||
    String(
      championships.rows.find((c) => Number(c.total_participants) > 0)?.champ_id ??
        championships.rows[0]?.champ_id ??
        "",
    );
  const championship = championships.rows.find((c) => String(c.champ_id) === selectedId);
  const results = useLoad<unknown>(
    selectedId
      ? teacherPortal
        ? `/teacher/championships/${encodeURIComponent(selectedId)}/participants`
        : `/championships/${encodeURIComponent(selectedId)}/leaderboard?limit=1000`
      : null,
    revision,
  );
  // Ranks come from the whole field, so filtering never renumbers anyone.
  const ranked = useMemo(
    () => rankAttempts(rowsOf(results.data).map((row, i) => normalizeAttempt(row, i))),
    [results.data],
  );
  useEffect(() => setViewing(null), [selectedId]);
  const sets = distinct(ranked, "label_id", "label_name");
  const teachers = [
    ...new Map(
      ranked.filter((r) => r.teacher_id).map((r) => [r.teacher_id, `${r.teacher_name} (${teacherCode(r)})`]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const dateError = filters.from && filters.to && filters.from > filters.to;
  const visible = ranked.filter((r) => {
    const day = r.completed_at.slice(0, 10);
    const who = filters.participant.trim();
    return (
      (!filters.labelId || r.label_id === filters.labelId) &&
      (!filters.teacherId || r.teacher_id === filters.teacherId) &&
      (!filters.from || day >= filters.from) &&
      (!filters.to || day <= filters.to) &&
      (!filters.rank || r.rank <= Number(filters.rank)) &&
      (!filters.result || r.result === filters.result) &&
      (!who ||
        matchesSearch(`${r.user_name} ${r.user_email}`, who) ||
        participantCode(r).toLowerCase().includes(who.toLowerCase()) ||
        r.user_id.includes(who))
    );
  });
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const n = visible.length || 1;
  const avg = (pick: (r: Attempt) => number) => visible.reduce((t, r) => t + pick(r), 0) / n;
  const kpis = [
    { label: "Participants", icon: "users", value: visible.length.toLocaleString(), definition: `of ${ranked.length.toLocaleString()} in this championship` },
    { label: "Top marks", icon: "trophy", value: visible.length ? `${Math.max(...visible.map((r) => r.marks))}` : "—", definition: visible[0] ? `out of ${visible[0].total_marks}` : "No results" },
    { label: "Average marks", icon: "chart", value: visible.length ? avg((r) => r.marks).toFixed(1) : "—", definition: "Per participant" },
    { label: "Average accuracy", icon: "question", value: visible.length ? percent(avg((r) => r.accuracy)) : "—", definition: "Correct ÷ attempted" },
    { label: "Average time", icon: "dashboard", value: visible.length ? formatDuration(avg((r) => r.time_taken_sec)) : "—", definition: "Per play" },
    { label: "Pass rate", icon: "file", value: visible.length ? percent((visible.filter((r) => r.result === "Passed").length / n) * 100) : "—", definition: `${PASS_PERCENT}% of total marks to pass` },
  ];

  return (
    <>
      <Heading
        title={championship ? `${championship.champ_name} · Leaderboard` : "Leaderboards"}
        breadcrumb={<Link href="/analytics">← Championship analytics</Link>}
        description="Ranked by marks, then accuracy, then the faster completion time. Equal on all three shares a rank."
        action={
          championship && (
            <Button variant="secondary" href={`/championships/${encodeURIComponent(selectedId)}`}>
              Championship details
            </Button>
          )
        }
      />
      <Card className="analytics-filters">
        <div className="filter-grid">
          <label>
            Championship
            <select
              value={selectedId}
              disabled={championships.loading}
              onChange={(e) => {
                setFilters(EMPTY);
                router.push(`/leaderboard/${encodeURIComponent(e.target.value)}`);
              }}
            >
              {!selectedId && <option value="">Choose a championship</option>}
              {championships.rows.map((c) => (
                <option key={String(c.champ_id)} value={String(c.champ_id)}>
                  {String(c.champ_name)} ({championshipCode(c)})
                </option>
              ))}
            </select>
          </label>
          <label>
            Question set
            <select value={filters.labelId} onChange={(e) => update({ labelId: e.target.value })}>
              <option value="">All question sets</option>
              {sets.map(([id, name]) => (
                <option key={id} value={id}>
                  {name} ({questionSetCode({ label_id: id })})
                </option>
              ))}
            </select>
          </label>
          {!teacherPortal && (
            <label>
              Teacher
              <select value={filters.teacherId} onChange={(e) => update({ teacherId: e.target.value })}>
                <option value="">All teachers</option>
                {teachers.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Participant
            <input
              type="search"
              value={filters.participant}
              onChange={(e) => update({ participant: e.target.value })}
              placeholder="Name, email or participant ID"
            />
          </label>
          <label>
            From
            <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value })} />
          </label>
          <label>
            To
            <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value })} />
          </label>
          <label>
            Rank
            <select value={filters.rank} onChange={(e) => update({ rank: e.target.value })}>
              {RANK_LIMITS.map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Result
            <select value={filters.result} onChange={(e) => update({ result: e.target.value })}>
              <option value="">All results</option>
              {RESULTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="filter-footer">
          <span className="muted" role="status">
            {activeFilters ? `${activeFilters} ${activeFilters === 1 ? "filter" : "filters"} applied` : "Showing every participant"}
          </span>
          {activeFilters > 0 && (
            <Button size="sm" variant="text" onClick={() => setFilters(EMPTY)}>
              Reset filters
            </Button>
          )}
        </div>
        {dateError && <Notice kind="error">The start date must be on or before the end date.</Notice>}
      </Card>
      {championships.error ? (
        <Retry error={championships.error} onRetry={() => setRevision((v) => v + 1)} />
      ) : !selectedId && !championships.loading ? (
        <Notice kind="info">There are no championships yet.</Notice>
      ) : results.error ? (
        <Retry error={results.error} onRetry={() => setRevision((v) => v + 1)} />
      ) : (
        <>
          <section className="metrics analytics-metrics" aria-label="Leaderboard summary">
            {kpis.map((kpi) => (
              <MetricCard
                key={kpi.label}
                icon={<Icon name={kpi.icon} />}
                label={kpi.label}
                value={kpi.value}
                definition={kpi.definition}
                loading={results.loading || championships.loading}
                delta={<small className="delta">{kpi.definition}</small>}
              />
            ))}
          </section>
          <Card>
            <DataTable
              key={selectedId}
              rows={visible as unknown as Row[]}
              loading={results.loading || championships.loading}
              searchable={false}
              sortable={["rank", "user_name", "correct", "incorrect", "marks", "accuracy", "time_taken_sec", "completed_at"]}
              defaultSort={{ key: "rank", dir: "asc" }}
              rowKey={(row) => String(row.attempt_id)}
              emptyMessage={activeFilters ? "No participants match these filters" : "No results yet"}
              emptyDescription={activeFilters ? "Reset or widen the filters." : "Results appear here once participants complete this championship."}
              columns={[
                ["rank", "Rank"],
                ["user_name", "Participant"],
                ["user_id", "Participant ID"],
                ["teacher_name", "Teacher"],
                ["teacher_id", "Teacher ID"],
                ["label_name", "Question set"],
                ["correct", "Correct"],
                ["incorrect", "Incorrect"],
                ["total_questions", "Total questions"],
                ["marks", "Marks"],
                ["total_marks", "Total marks"],
                ["accuracy", "Accuracy"],
                ["time_taken_sec", "Time taken"],
                ["completed_at", "Completed"],
                ["result", "Result"],
              ]}
              render={{
                rank: (row) => <RankBadge rank={Number(row.rank)} />,
                user_name: (row) => (
                  <button type="button" className="text-button table-link" onClick={() => setViewing(row as unknown as Attempt)}>
                    {String(row.user_name)}
                  </button>
                ),
                user_id: (row) => (row.user_id ? <code className="entity-code">{participantCode(row)}</code> : "—"),
                teacher_name: (row) => String(row.teacher_name || "—"),
                teacher_id: (row) => (row.teacher_id ? <code className="entity-code">{teacherCode(row)}</code> : "—"),
                label_name: (row) => String(row.label_name || "—"),
                accuracy: (row) => percent(Number(row.accuracy)),
                time_taken_sec: (row) => formatDuration(row.time_taken_sec),
                completed_at: (row) => formatDateTime(row.completed_at),
                result: (row) => <ResultBadge result={String(row.result)} />,
              }}
              actions={(row) => (
                <IconActions>
                  <IconButton icon="view" label="View participant details" onClick={() => setViewing(row as unknown as Attempt)} />
                </IconActions>
              )}
            />
          </Card>
        </>
      )}
      {viewing && (
        <ParticipantDetails
          attempt={viewing}
          championshipId={selectedId}
          championshipName={String(championship?.champ_name || viewing.champ_name || "Championship")}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}

const outcomeBadge: Record<string, [BadgeVariant, string]> = {
  correct: ["active", "Correct"],
  incorrect: ["suspended", "Incorrect"],
  unattempted: ["neutral", "Not attempted"],
};

function ParticipantDetails({
  attempt,
  championshipId,
  championshipName,
  onClose,
}: {
  attempt: Attempt;
  championshipId: string;
  championshipName: string;
  onClose: () => void;
}) {
  const detail = useLoad<Row>(
    `/championships/${encodeURIComponent(championshipId)}/attempts/${encodeURIComponent(attempt.attempt_id)}`,
  );
  const questions = rowsOf(detail.data?.questions);
  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={attempt.user_name}
      description={
        <>
          <code className="entity-code">{participantCode(attempt)}</code> · Rank {attempt.rank} · <ResultBadge result={attempt.result} />
        </>
      }
    >
      <dl className="details-grid compact">
        {[
          ["Participant", attempt.user_name],
          ["Participant ID", participantCode(attempt)],
          ["Email", attempt.user_email || "—"],
          ["Championship", championshipName],
          ["Question set", attempt.label_name || "—"],
          ["Teacher", attempt.teacher_name ? `${attempt.teacher_name} (${teacherCode(attempt)})` : "—"],
          ["Participated on", formatDateTime(attempt.completed_at)],
          ["Total time taken", formatDuration(attempt.time_taken_sec)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="score-grid" aria-label="Score summary">
        {[
          ["Total questions", attempt.total_questions],
          ["Correct", attempt.correct],
          ["Incorrect", attempt.incorrect],
          ["Not attempted", attempt.unattempted],
          ["Marks", `${attempt.marks} / ${attempt.total_marks}`],
          ["Accuracy", percent(attempt.accuracy)],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <h3 className="drawer-section-title">Question-wise results</h3>
      {detail.loading ? (
        <Loading text="Loading answers…" />
      ) : detail.error ? (
        <Notice kind="info">
          Question-wise answers are not available from the service for this attempt.
        </Notice>
      ) : (
        <div className="table-scroll">
          <table className="compact-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Question</th>
                <th>Submitted answer</th>
                <th>Correct answer</th>
                <th>Result</th>
                <th className="num">Marks</th>
                <th className="num">Time</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => {
                const [variant, label] = outcomeBadge[String(q.outcome)] || ["neutral", String(q.outcome)];
                return (
                  <tr key={String(q.number)}>
                    <td>{String(q.number)}</td>
                    <td>{String(q.question_text)}</td>
                    <td>{q.submitted_answer ? String(q.submitted_answer) : <span className="muted">—</span>}</td>
                    <td>{String(q.correct_answer)}</td>
                    <td>
                      <Badge variant={variant}>{label}</Badge>
                    </td>
                    <td className="num">{String(q.marks)}</td>
                    <td className="num">{formatDuration(q.time_taken_sec)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Drawer>
  );
}
