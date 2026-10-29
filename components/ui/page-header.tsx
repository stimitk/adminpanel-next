"use client";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  badge,
  breadcrumb,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`page-heading ${className}`.trim()}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {breadcrumb && (
          <nav aria-label="Breadcrumb" style={{ marginBottom: 6, fontSize: 12, color: "var(--muted)" }}>
            {breadcrumb}
          </nav>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0 }}>{title}</h1>
          {badge}
        </div>
        {description && (
          <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}

// Backward-compatible Heading component
export const Heading = PageHeader;
