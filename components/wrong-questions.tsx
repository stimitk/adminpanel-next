"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorText, rowsOf } from "../lib/api";
import { championshipPhase, type ChampionshipPhase } from "../lib/championships";
import { championshipCode, participantCode, questionCode } from "../lib/codes";
import { formatDateTime } from "../lib/performance";
import { portal } from "../lib/portal";
import { plainRichText } from "../lib/rich-text";
import type { Row } from "../lib/types";
import { KpiCards, type Stat } from "./charts";
import { useChampionshipList } from "./championships";
import { RichText } from "./rich-text-editor";
import {
  ACTIONS_COLUMN,
  SERIAL_COLUMN,
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  Heading,
  IconActions,
  IconButton,
  Identity,
  Notice,
  Retry,
  useConfirm,
  useLoad,
  type BadgeVariant,
} from "./ui";

// Only admins verify reports and pay bonus coins; championship makers can read them.
const canReview = portal.kind === "admin";
const MAX_BONUS = 1000;

type ReportStatus = "pending" | "verified" | "rejected" | "rewarded";
const reportStatus: Record<ReportStatus, [BadgeVariant, string]> = {
  pending: ["pending", "Pending review"],
  verified: ["info", "Verified incorrect"],
  rejected: ["inactive", "Rejected"],
  rewarded: ["active", "Rewarded"],
};
const statusOf = (row: Row): ReportStatus =>
  (String(row.status) in reportStatus ? String(row.status) : "pending") as ReportStatus;

const phaseVariant: Record<ChampionshipPhase, BadgeVariant> = {
  Live: "active",
  Scheduled: "info",
  Ended: "neutral",
  Inactive: "inactive",
  Blocked: "suspended",
};

// Where the question stands overall, from its reports.
function reviewOf(reports: Row[]): [BadgeVariant, string] {
  if (!reports.length) return ["neutral", "Not reported"];
  const statuses = reports.map(statusOf);
  if (statuses.includes("pending")) return reportStatus.pending;
  if (statuses.includes("verified")) return reportStatus.verified;
  if (statuses.includes("rewarded")) return reportStatus.rewarded;
  return reportStatus.rejected;
}

// Reports that may still be paid: verified, and one per student, since a
// student is rewarded at most once per question.
function eligibleReports(reports: Row[]): Row[] {
  const paid = new Set(reports.filter((r) => statusOf(r) === "rewarded").map((r) => String(r.user_id)));
  const seen = new Set<string>();
  return reports
    .filter((r) => statusOf(r) === "verified")
    .sort((a, b) => String(a.reported_at).localeCompare(String(b.reported_at)))
    .filter((r) => {
      const user = String(r.user_id);
      if (paid.has(user) || seen.has(user)) return false;
      seen.add(user);
      return true;
    });
}

const distinctStudents = (reports: Row[]) => new Set(reports.map((r) => String(r.user_id))).size;
const coinsAwarded = (reports: Row[]) =>
  reports.reduce((total, r) => total + (statusOf(r) === "rewarded" ? Number(r.reward_coins || 0) : 0), 0);

function newRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function initialChampionship() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("championshipId") || "";
}

export function WrongQuestions() {
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState(initialChampionship);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const championships = useChampionshipList(0);
  const reportsLoad = useLoad<unknown>("/questions/wrong-reports", revision);
  const errorsLoad = useLoad<unknown>(
    `/questions/analytics/frequent-errors${selectedId ? `?championshipId=${encodeURIComponent(selectedId)}` : ""}`,
    revision,
  );
  const allReports = useMemo(() => rowsOf(reportsLoad.data), [reportsLoad.data]);
  const reports = useMemo(
    () => allReports.filter((r) => !selectedId || String(r.champ_id) === selectedId),
    [allReports, selectedId],
  );

  // Championships that have reports, most reported first.
  const reported = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of allReports) counts.set(String(r.champ_id), (counts.get(String(r.champ_id)) || 0) + 1);
    return [...counts.entries()]
      .map(([id, count]) => {
        const row = championships.rows.find((c) => String(c.champ_id) === id);
        const fallback = allReports.find((r) => String(r.champ_id) === id);
        return { id, count, row: row || { champ_id: id, champ_name: fallback?.champ_name } };
      })
      .sort((a, b) => b.count - a.count);
  }, [allReports, championships.rows]);
  // With reports from a single championship there is nothing to choose between.
  useEffect(() => {
    if (!selectedId && reported.length === 1) setSelectedId(reported[0].id);
  }, [reported, selectedId]);
  const selected =
    championships.rows.find((c) => String(c.champ_id) === selectedId) ||
    reported.find((c) => c.id === selectedId)?.row;

  // Every question with incorrect answers or reports, with its report summary.
  const questionRows = useMemo(() => {
    const byQuestion = new Map<string, Row[]>();
    for (const r of reports) byQuestion.set(String(r.question_id), [...(byQuestion.get(String(r.question_id)) || []), r]);
    const errors = rowsOf(errorsLoad.data);
    const ids = [...new Set([...errors.map((e) => String(e.question_id)), ...byQuestion.keys()])];
    return ids.map((id) => {
      const list = byQuestion.get(id) || [];
      const error = errors.find((e) => String(e.question_id) === id);
      const [variant, label] = reviewOf(list);
      return {
        question_id: error?.question_id ?? list[0]?.question_id,
        question_text: error?.question_text ?? list[0]?.question_text,
        error_count: error?.error_count ?? null,
        report_count: distinctStudents(list),
        pending: list.filter((r) => statusOf(r) === "pending").length,
        review: label,
        review_variant: variant,
        reports: list,
      } as Row;
    });
  }, [reports, errorsLoad.data]);
  const viewing = questionRows.find((q) => String(q.question_id) === viewingId);

  function choose(id: string) {
    setSelectedId(id);
    setViewingId(null);
    router.replace(id ? `/frequent-errors?championshipId=${encodeURIComponent(id)}` : "/frequent-errors");
  }

  const reportedQuestions = questionRows.filter((q) => Number(q.report_count) > 0);
  const kpis: Stat[] = [
    { label: "Reported questions", value: reportedQuestions.length.toLocaleString(), definition: "Questions at least one student reported as incorrect." },
    { label: "Students reporting", value: distinctStudents(reports).toLocaleString(), definition: "Distinct students who raised a report." },
    {
      label: "Pending review",
      value: reportedQuestions.filter((q) => Number(q.pending) > 0).length.toLocaleString(),
      definition: "Reported questions with reports an admin has not reviewed yet.",
    },
    { label: "Bonus coins awarded", value: coinsAwarded(reports).toLocaleString(), definition: "Coins paid to students for verified wrong questions." },
  ];
  const reportsUnavailable = !!reportsLoad.error;
  const loading = errorsLoad.loading || reportsLoad.loading;

  return (
    <>
      <Heading
        title="Wrong Questions"
        description="Questions students answer incorrectly most often or have reported as incorrect."
      />
      {reportsUnavailable ? (
        <Notice kind="info">
          Student reports are not available from the service ({reportsLoad.error}). Incorrect-answer counts are still shown.
        </Notice>
      ) : (
        <ChampionshipDetails
          loading={reportsLoad.loading || championships.loading}
          selectedId={selectedId}
          selected={selected}
          reported={reported}
          onChoose={choose}
        />
      )}
      {!reportsUnavailable && <KpiCards label="Wrong question summary" stats={kpis} loading={loading} />}
      <Card>
        {errorsLoad.error && !questionRows.length ? (
          <Retry error={errorsLoad.error} onRetry={() => setRevision((v) => v + 1)} />
        ) : (
          <DataTable
            key={selectedId}
            rows={questionRows}
            loading={loading}
            searchPlaceholder="Search questions"
            searchMatch={(row, query) =>
              plainRichText(row.question_text).toLowerCase().includes(query.toLowerCase()) ||
              questionCode(row).toLowerCase().includes(query.trim().toLowerCase())
            }
            sortable={["question_id", "error_count", "report_count", "review"]}
            defaultSort={{ key: "report_count", dir: "desc" }}
            rowKey={(row) => String(row.question_id)}
            emptyMessage="No wrong questions"
            emptyDescription={selectedId ? "Nothing has been reported for this championship." : "Questions appear here once students answer them incorrectly or report them."}
            columns={[
              [SERIAL_COLUMN, "Sr. No."],
              ["question_id", "Question ID"],
              ["question_text", "Question"],
              ["error_count", "Incorrect answers"],
              ["report_count", "Student reports"],
              ["review", "Review status"],
              [ACTIONS_COLUMN, "Actions"],
            ]}
            render={{
              question_id: (row) => <code className="entity-code">{questionCode(row)}</code>,
              error_count: (row) => (row.error_count === null ? "—" : Number(row.error_count).toLocaleString()),
              review: (row) => <Badge variant={row.review_variant as BadgeVariant}>{String(row.review)}</Badge>,
            }}
            actions={(row) => (
              <IconActions>
                <IconButton
                  icon="view"
                  label="View student reports"
                  disabled={!Number(row.report_count)}
                  disabledReason={reportsUnavailable ? "Student reports are unavailable" : "No student has reported this question"}
                  onClick={() => setViewingId(String(row.question_id))}
                />
              </IconActions>
            )}
          />
        )}
      </Card>
      {viewing && (
        <ReportDetails
          question={viewing}
          championshipId={selectedId}
          onChanged={() => setRevision((v) => v + 1)}
          onClose={() => setViewingId(null)}
        />
      )}
    </>
  );
}

function modeNames(row: Row) {
  const names = rowsOf(row.modes).map((m) => String(m.mode_name || "")).filter(Boolean);
  return names.length ? [...new Set(names)].join(", ") : String(row.mode_name || "—");
}
function dateTime(date: unknown, time: unknown) {
  if (!date) return "—";
  const day = String(date).slice(0, 10);
  return formatDateTime(time ? `${day}T${String(time).slice(0, 8)}` : day);
}
function PhaseBadge({ row }: { row: Row }) {
  const phase = championshipPhase(row);
  return <Badge variant={phaseVariant[phase]}>{phase}</Badge>;
}

function ChampionshipDetails({
  loading,
  selectedId,
  selected,
  reported,
  onChoose,
}: {
  loading: boolean;
  selectedId: string;
  selected?: Row;
  reported: { id: string; count: number; row: Row }[];
  onChoose: (id: string) => void;
}) {
  const options = reported.some((c) => c.id === selectedId) || !selectedId
    ? reported
    : [...reported, { id: selectedId, count: 0, row: selected || { champ_id: selectedId } }];
  return (
    <Card className="analytics-filters">
      <div className="section-heading">
        <h2>Championship Details</h2>
        {options.length > 1 && (
          <label className="inline-filter">
            <span className="muted">Championship</span>
            <select value={selectedId} disabled={loading} onChange={(e) => onChoose(e.target.value)}>
              <option value="">All championships ({reported.length})</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {String(c.row.champ_name || "Championship")} ({championshipCode(c.row)})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {loading ? (
        <p className="muted">Loading championship details…</p>
      ) : selectedId && selected ? (
        <dl className="details-grid compact">
          {[
            ["Championship ID", <code key="id" className="entity-code">{championshipCode(selected)}</code>],
            ["Championship Name", String(selected.champ_name || "—")],
            ["Category", String(selected.category_name || "—")],
            ["Start Date", dateTime(selected.start_date, selected.start_time)],
            ["End Date", dateTime(selected.end_date, selected.end_time)],
            ["Game Mode", modeNames(selected)],
            ["Status", <PhaseBadge key="status" row={selected} />],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : reported.length ? (
        <div className="table-scroll">
          <table className="compact-table">
            <thead>
              <tr>
                <th>Championship ID</th>
                <th>Championship Name</th>
                <th>Category</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Game Mode</th>
                <th>Status</th>
                <th className="num">Reports</th>
              </tr>
            </thead>
            <tbody>
              {reported.map(({ id, count, row }) => (
                <tr key={id}>
                  <td>
                    <button type="button" className="text-button" onClick={() => onChoose(id)} aria-label={`Show reports for ${String(row.champ_name || id)}`}>
                      <code className="entity-code">{championshipCode(row)}</code>
                    </button>
                  </td>
                  <td>{String(row.champ_name || "—")}</td>
                  <td>{String(row.category_name || "—")}</td>
                  <td>{dateTime(row.start_date, row.start_time)}</td>
                  <td>{dateTime(row.end_date, row.end_time)}</td>
                  <td>{modeNames(row)}</td>
                  <td>{row.start_date ? <PhaseBadge row={row} /> : "—"}</td>
                  <td className="num">{count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          No student has reported a wrong question yet.
        </p>
      )}
    </Card>
  );
}

function ReportDetails({
  question,
  championshipId,
  onChanged,
  onClose,
}: {
  question: Row;
  championshipId: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { confirm, dialog } = useConfirm();
  const reports = (question.reports || []) as Row[];
  const questionId = String(question.question_id);
  const eligible = eligibleReports(reports);
  const eligibleIds = eligible.map((r) => String(r.report_id));
  const pending = reports.filter((r) => statusOf(r) === "pending").length;
  const verified = reports.some((r) => ["verified", "rewarded"].includes(statusOf(r)));
  const anyRewarded = reports.some((r) => statusOf(r) === "rewarded");
  const [busy, setBusy] = useState<"verify" | "reward" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [coins, setCoins] = useState("10");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [requestId, setRequestId] = useState(newRequestId);
  const recipients = scope === "all" ? eligibleIds : picked.filter((id) => eligibleIds.includes(id));
  const amount = Number(coins);
  const amountError =
    coins === "" ? "Enter a coin amount." : !Number.isInteger(amount) || amount < 1 || amount > MAX_BONUS ? `Enter a whole number from 1 to ${MAX_BONUS}.` : "";
  // A changed payload is a new request; an unchanged retry reuses the ID so the
  // service can recognise it and never pay twice.
  useEffect(() => setRequestId(newRequestId()), [coins, scope, picked]);

  async function verify(verdict: "incorrect" | "correct") {
    const ok = await confirm(
      verdict === "incorrect"
        ? {
            title: "Confirm the question is incorrect?",
            message: `${pending} pending ${pending === 1 ? "report" : "reports"} will be marked verified. You can then award bonus coins to the students who reported it. Remember to correct the question itself.`,
            confirmLabel: "Confirm incorrect",
          }
        : {
            title: "Mark the question as correct?",
            message: "The reports will be rejected and no bonus coins can be awarded for them.",
            confirmLabel: "Reject reports",
            isDangerous: true,
          },
    );
    if (!ok) return;
    setError("");
    setSuccess("");
    setBusy("verify");
    try {
      await api("/admin/wrong-reports/verify", { method: "POST", body: { questionId: question.question_id, verdict } });
      setSuccess(verdict === "incorrect" ? "Question verified as incorrect." : "Reports rejected. The question is marked correct.");
      onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function reward() {
    if (amountError || !recipients.length || busy) return;
    const total = amount * recipients.length;
    const ok = await confirm({
      title: "Award bonus coins?",
      message: `${amount.toLocaleString()} coins will be added to each of ${recipients.length} ${recipients.length === 1 ? "student" : "students"} (${total.toLocaleString()} coins in total). Students who were already rewarded for this question are skipped. This cannot be undone.`,
      confirmLabel: "Award coins",
    });
    if (!ok) return;
    setError("");
    setSuccess("");
    setBusy("reward");
    try {
      const result = await api<{ awarded?: Row[]; skipped?: Row[]; totalCoins?: number }>("/admin/wrong-reports/rewards", {
        method: "POST",
        body: { questionId: question.question_id, coins: amount, reportIds: recipients.map(Number), requestId },
      });
      const awarded = rowsOf(result?.awarded).length;
      const skipped = rowsOf(result?.skipped).length;
      setSuccess(
        `Awarded ${Number(result?.totalCoins ?? awarded * amount).toLocaleString()} coins to ${awarded} ${awarded === 1 ? "student" : "students"}.` +
          (skipped ? ` ${skipped} already rewarded ${skipped === 1 ? "student was" : "students were"} skipped.` : ""),
      );
      setPicked([]);
      setRequestId(newRequestId());
      onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title="Student reports"
      description={
        <>
          <code className="entity-code">{questionCode(question)}</code> · {distinctStudents(reports)}{" "}
          {distinctStudents(reports) === 1 ? "student has" : "students have"} reported this question
          {championshipId ? " in this championship" : ""}
        </>
      }
    >
      <div className="wrong-question-text">
        <RichText value={question.question_text} />
      </div>
      <div className="score-grid" aria-label="Report summary">
        {[
          ["Students reporting", distinctStudents(reports)],
          ["Pending review", pending],
          ["Eligible for bonus", eligible.length],
          ["Rewarded", reports.filter((r) => statusOf(r) === "rewarded").length],
          ["Coins awarded", coinsAwarded(reports).toLocaleString()],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {success && <Notice kind="success">{success}</Notice>}

      {canReview && (
        <section className="review-panel" aria-labelledby="verify-title">
          <h3 id="verify-title" className="drawer-section-title">1. Verify the question</h3>
          {pending ? (
            <>
              <p className="muted">
                Check the question, its options and the marked answer. Bonus coins can only be awarded after you confirm it is incorrect.
              </p>
              <div className="review-actions">
                <Button href={`/questions/${encodeURIComponent(questionId)}/edit`} variant="secondary" size="sm">
                  Open question
                </Button>
                <Button size="sm" loading={busy === "verify"} disabled={!!busy} onClick={() => verify("incorrect")}>
                  Confirm incorrect
                </Button>
                <Button size="sm" variant="danger" disabled={!!busy || anyRewarded} onClick={() => verify("correct")}>
                  Question is correct
                </Button>
              </div>
            </>
          ) : (
            <p className="muted">
              {verified ? "Verified as incorrect." : "Reviewed: the question is correct and its reports were rejected."}
            </p>
          )}

          <h3 className="drawer-section-title">2. Award bonus coins</h3>
          {!verified ? (
            <p className="muted">Available once the question is verified as incorrect.</p>
          ) : !eligible.length ? (
            <p className="muted">Every student who reported this question has been rewarded.</p>
          ) : (
            <div className="reward-form">
              <label>
                Bonus coins per student
                <input
                  type="number"
                  min={1}
                  max={MAX_BONUS}
                  step={1}
                  value={coins}
                  onChange={(e) => setCoins(e.target.value)}
                  aria-invalid={!!amountError}
                />
                {amountError && <small className="field-error">{amountError}</small>}
              </label>
              <fieldset>
                <legend>Recipients</legend>
                <label className="check-option">
                  <input type="radio" name="reward-scope" checked={scope === "all"} onChange={() => setScope("all")} />
                  All eligible students ({eligible.length})
                </label>
                <label className="check-option">
                  <input type="radio" name="reward-scope" checked={scope === "selected"} onChange={() => setScope("selected")} />
                  Selected students{scope === "selected" ? ` (${recipients.length} chosen in the table below)` : ""}
                </label>
              </fieldset>
              <Button loading={busy === "reward"} disabled={!!busy || !!amountError || !recipients.length} onClick={reward}>
                {recipients.length
                  ? `Award ${amountError ? "" : `${(amount * recipients.length).toLocaleString()} `}coins to ${recipients.length} ${recipients.length === 1 ? "student" : "students"}`
                  : "Select students to reward"}
              </Button>
            </div>
          )}
        </section>
      )}

      <h3 className="drawer-section-title">Reported by</h3>
      <DataTable
        rows={reports}
        searchPlaceholder="Search students"
        searchMatch={(row, q) =>
          `${row.user_name} ${row.user_email} ${participantCode(row)}`.toLowerCase().includes(q.trim().toLowerCase())
        }
        sortable={["user_name", "champ_id", "reported_at", "status"]}
        defaultSort={{ key: "reported_at", dir: "desc" }}
        rowKey={(row) => String(row.report_id)}
        pageSize={10}
        selection={
          canReview && verified && scope === "selected"
            ? {
                selected: picked,
                onChange: setPicked,
                rowId: (row) => String(row.report_id),
                rowLabel: (row) => String(row.user_name),
                title: "Reward",
                isDisabled: (row) => !eligibleIds.includes(String(row.report_id)),
              }
            : undefined
        }
        columns={[
          [SERIAL_COLUMN, "Sr. No."],
          ["user_name", "Student Name"],
          ["user_email", "Email"],
          ["champ_id", "Championship ID"],
          ["reported_at", "Reported On"],
          ["status", "Report Status"],
          ["reward_coins", "Bonus"],
          ["coin_balance", "Coin balance"],
        ]}
        render={{
          user_name: (row) => <Identity name={row.user_name} code={row.user_id ? participantCode(row) : null} />,
          champ_id: (row) => (
            <span title={String(row.champ_name || "")}>
              <code className="entity-code">{championshipCode(row)}</code>
            </span>
          ),
          reported_at: (row) => formatDateTime(row.reported_at),
          status: (row) => {
            const [variant, label] = reportStatus[statusOf(row)];
            return <Badge variant={variant}>{label}</Badge>;
          },
          reward_coins: (row) =>
            statusOf(row) === "rewarded" ? (
              <span className="date-time">
                +{Number(row.reward_coins).toLocaleString()} coins
                <small>{formatDateTime(row.rewarded_at)}</small>
              </span>
            ) : (
              "—"
            ),
          coin_balance: (row) => (row.coin_balance === undefined || row.coin_balance === null ? "—" : Number(row.coin_balance).toLocaleString()),
        }}
      />
      {dialog}
    </Drawer>
  );
}
