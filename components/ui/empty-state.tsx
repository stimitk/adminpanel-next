"use client";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title = "No records found",
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`empty-state ${className}`.trim()}
      style={{
        textAlign: "center",
        padding: "48px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      {icon && (
        <div
          className="empty-state-icon"
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#f4f0e8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--muted)",
            fontSize: 22,
          }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3
        className="empty-state-title"
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          color: "var(--ink)",
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="empty-state-desc"
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--muted)",
            maxWidth: 420,
          }}
        >
          {description}
        </p>
      )}
      {action && (
        <div className="empty-state-action" style={{ marginTop: 8 }}>
          {action}
        </div>
      )}
    </div>
  );
}
