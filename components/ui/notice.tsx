"use client";
import type { ReactNode } from "react";

export type NoticeKind = "error" | "success" | "info";

export interface NoticeProps {
  children: ReactNode;
  kind?: NoticeKind;
  className?: string;
  onDismiss?: () => void;
}

export function Notice({
  children,
  kind = "error",
  className = "",
  onDismiss,
}: NoticeProps) {
  return (
    <div
      className={`notice notice-${kind} ${onDismiss ? "is-dismissible" : ""} ${className}`.trim()}
      role={kind === "error" ? "alert" : "status"}
    >
      <div style={{ flex: 1 }}>{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-button notice-dismiss"
          aria-label="Dismiss notice"
          style={{ marginLeft: 12, minHeight: 0, padding: 0 }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export interface RetryProps {
  error: string;
  onRetry: () => void;
  className?: string;
}

export function Retry({ error, onRetry, className = "" }: RetryProps) {
  return (
    <Notice kind="error" className={className}>
      <span>{error}</span>{" "}
      <button
        type="button"
        className="text-button"
        onClick={onRetry}
        style={{ fontWeight: 600, marginLeft: 6 }}
      >
        Try again
      </button>
    </Notice>
  );
}
