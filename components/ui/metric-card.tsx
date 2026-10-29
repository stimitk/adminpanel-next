"use client";
import type { ReactNode } from "react";
import { Skeleton } from "./skeleton";

export interface DeltaProps {
  current: number | null;
  previous: number | null;
  days: number;
  good?: "up" | "neutral";
  points?: boolean;
}

export function DeltaTrend({
  current,
  previous,
  days,
  good = "up",
  points = false,
}: DeltaProps) {
  if (current === null || previous === null) {
    return <small className="delta">No comparison available</small>;
  }

  if (!points && previous === 0) {
    return (
      <small className="delta">
        {current ? "New this period" : "No change"} · prev. {days} days
      </small>
    );
  }

  const change = points
    ? current - previous
    : ((current - previous) / previous) * 100;
  const rounded = Math.round(change * 10) / 10;
  const tone =
    rounded === 0 || good === "neutral" ? "" : rounded > 0 ? "up" : "down";

  return (
    <small className={`delta ${tone}`}>
      {rounded > 0 ? "▲" : rounded < 0 ? "▼" : "■"}{" "}
      {rounded > 0 ? "+" : ""}
      {rounded.toLocaleString()}
      {points ? " pts" : "%"} vs prev. {days} days
    </small>
  );
}

export interface MetricCardProps {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  definition?: string;
  delta?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function MetricCard({
  icon,
  label,
  value,
  definition,
  delta,
  loading = false,
  className = "",
}: MetricCardProps) {
  return (
    <div className={`metric ${loading ? "skeleton" : ""} ${className}`.trim()}>
      {icon}
      <span title={definition}>{label}</span>
      <strong>
        {loading ? (
          <Skeleton width="60%" height="28px" style={{ margin: "4px 0" }} />
        ) : (
          value
        )}
      </strong>
      {!loading && delta}
    </div>
  );
}
