"use client";
import type { ReactNode } from "react";

export type BadgeVariant =
  | "active"
  | "inactive"
  | "pending"
  | "suspended"
  | "info"
  | "neutral";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  withDot?: boolean;
}

export function Badge({
  children,
  variant = "neutral",
  className = "",
  withDot = false,
}: BadgeProps) {
  const variantClass = `status-${variant}`;

  return (
    <span className={`status ${variantClass} ${className}`.trim()}>
      {withDot && <span className="status-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export interface StatusBadgeProps {
  status: unknown;
  kind?: "teacher" | "default";
  className?: string;
}

export function StatusBadge({
  status,
  kind = "default",
  className = "",
}: StatusBadgeProps) {
  if (kind === "teacher") {
    const num = Number(status);
    if (num === 1) {
      return (
        <Badge variant="active" className={className}>
          Approved
        </Badge>
      );
    }
    if (num === 0) {
      return (
        <Badge variant="pending" className={className}>
          Pending
        </Badge>
      );
    }
    if (num === 2) {
      return (
        <Badge variant="suspended" className={className}>
          Suspended
        </Badge>
      );
    }
    return <Badge variant="neutral" className={className}>{String(status ?? "—")}</Badge>;
  }

  // Default active/inactive (1/0, "ACTIVE", etc.)
  const isActive = status === 1 || status === "1" || status === "ACTIVE" || status === true;
  const isInactive = status === 0 || status === "0" || status === "INACTIVE" || status === false;

  if (isActive) {
    return (
      <Badge variant="active" className={className}>
        Active
      </Badge>
    );
  }

  if (isInactive) {
    return (
      <Badge variant="inactive" className={className}>
        Inactive
      </Badge>
    );
  }

  return (
    <Badge variant="neutral" className={className}>
      {status === null || status === undefined || status === "" ? "—" : String(status)}
    </Badge>
  );
}
