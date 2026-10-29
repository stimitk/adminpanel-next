"use client";
import { useState } from "react";
import Link from "next/link";
import { portal } from "../lib/portal";
import { rowsOf } from "../lib/api";
import type { Row } from "../lib/types";
import { DataTable, Heading, Loading, Retry, useLoad } from "./ui";
import { Icon } from "./shell";
export function Dashboard() {
  const [revision, setRevision] = useState(0);
  const stats = useLoad<Record<string, number>>(
    `/${portal.kind === "teacher" ? "teacher" : "admin"}/dashboard-stats`,
    revision,
  );
  const championships = useLoad<unknown>(
    portal.kind === "teacher"
      ? "/teacher/championships"
      : "/championships/feed",
    revision,
  );
  const metrics =
    portal.kind === "teacher"
      ? [
          ["championshipsCount", "Championships", "trophy"],
          ["questionsCount", "Questions", "question"],
          ["studentsReached", "Students Reached", "users"],
          ["totalQuizzesCompleted", "Quizzes Completed", "chart"],
        ]
      : [
          ["totalUsers", "Registered Users", "users"],
          ["totalTeachers", "Teachers", "users"],
          ["totalChampionships", "Championships", "trophy"],
          ["totalQuestions", "Questions", "question"],
          ["totalQuizzesPlayed", "Quizzes Played", "chart"],
        ];
  return (
    <>
      <Heading
        title="Dashboard"
        action={
          <Link className="button" href="/championships/new">
            Create Championship
          </Link>
        }
      />
      {stats.loading ? (
        <Loading />
      ) : stats.error ? (
        <Retry error={stats.error} onRetry={() => setRevision((v) => v + 1)} />
      ) : (
        <section className="metrics" aria-label="Portal summary">
          {metrics.map(([key, label, icon]) => (
            <div className="metric" key={key}>
              <Icon name={icon} />
              <span>{label}</span>
              <strong>{Number(stats.data?.[key] || 0).toLocaleString()}</strong>
            </div>
          ))}
        </section>
      )}
      <section className="paper">
        <div className="section-heading">
          <h2>
            {portal.kind === "teacher"
              ? "Your Championships"
              : "Active Championships"}
          </h2>
          <Link href="/championships">View all</Link>
        </div>
        {championships.loading ? (
          <Loading />
        ) : championships.error ? (
          <Retry
            error={championships.error}
            onRetry={() => setRevision((v) => v + 1)}
          />
        ) : (
          <DataTable
            rows={rowsOf(championships.data).slice(0, 8)}
            columns={[
              ["champ_name", "Championship"],
              ["category_name", "Category"],
              ["start_date", "Starts"],
              ["end_date", "Ends"],
              ["status", "Status"],
            ]}
            actions={(row: Row) => (
              <Link
                className="button small secondary"
                href={`/championships/${encodeURIComponent(String(row.champ_id))}`}
              >
                View
              </Link>
            )}
          />
        )}
      </section>
    </>
  );
}
