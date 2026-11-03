"use client";
import { useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";

// One stroke icon set for every row action, so meaning stays consistent.
const actionPaths: Record<string, string[]> = {
  view: ["M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  edit: ["M4 20h4L19 9l-4-4L4 16v4Z", "M13.5 6.5l4 4"],
  delete: ["M4 7h16M10 11v6M14 11v6", "M6 7l1 13h10l1-13M9 7V4h6v3"],
  block: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M5.6 5.6l12.8 12.8"],
  unblock: ["M7 11V7a5 5 0 0 1 9.6-2", "M5 11h14v10H5z", "M12 15v2"],
  activate: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M8 12.5l2.7 2.7L16 9.8"],
  deactivate: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M9 9l6 6M15 9l-6 6"],
  more: ["M5 12h.01M12 12h.01M19 12h.01"],
  leaderboard: ["M8 3h8v7a4 4 0 0 1-8 0V3Z", "M8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 14v6M8 21h8"],
  analytics: ["M4 3v17h17", "M8 16v-4M13 16V8M18 16V5"],
  approve: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M8 12.5l2.7 2.7L16 9.8"],
  back: ["M19 12H5M11 6l-6 6 6 6"],
  search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-5-5"],
  close: ["M6 6l12 12M18 6L6 18"],
  "sort-asc": ["M12 5l-5 6h10l-5-6Z"],
  "sort-desc": ["M12 19l-5-6h10l-5 6Z"],
  sort: ["M12 4l-4 5h8l-4-5ZM12 20l-4-5h8l-4 5Z"],
};

export function ActionIcon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "more" ? 3 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {(actionPaths[name] || actionPaths.more).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

// Tooltip rendered with fixed positioning so scrolling table containers never clip it.
export function Tooltip({
  label,
  children,
  className = "",
  style,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const show = () => {
    const box = ref.current?.getBoundingClientRect();
    if (box) setPosition({ top: box.top - 6, left: box.left + box.width / 2 });
  };
  const hide = () => setPosition(null);
  return (
    <span
      ref={ref}
      className={`tooltip-anchor ${className}`.trim()}
      style={style}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {position && (
        <span
          role="tooltip"
          className="tooltip"
          style={{ top: position.top, left: position.left }}
        >
          {label}
        </span>
      )}
    </span>
  );
}

export type IconButtonTone = "default" | "danger" | "success" | "warning";

export interface IconButtonProps {
  icon: string;
  // Shown as the tooltip and used as the accessible name.
  label: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  href?: string;
  tone?: IconButtonTone;
  disabled?: boolean;
  loading?: boolean;
  // Explains why a disabled action is unavailable.
  disabledReason?: string;
}

export function IconButton({
  icon,
  label,
  onClick,
  href,
  tone = "default",
  disabled = false,
  loading = false,
  disabledReason,
}: IconButtonProps) {
  const tip = disabled && disabledReason ? disabledReason : label;
  const className = `icon-button tone-${tone}${loading ? " is-loading" : ""}`;
  const content = loading ? <span className="spinner icon-spinner" aria-hidden="true" /> : <ActionIcon name={icon} />;
  return (
    <Tooltip label={tip}>
      {href && !disabled ? (
        <Link className={className} href={href} aria-label={label}>
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className={className}
          aria-label={label}
          aria-disabled={disabled || loading || undefined}
          onClick={(event) => {
            if (disabled || loading) return;
            onClick?.(event);
          }}
        >
          {content}
        </button>
      )}
    </Tooltip>
  );
}

// Groups row actions with consistent spacing.
export function IconActions({ children }: { children: ReactNode }) {
  return <div className="icon-actions">{children}</div>;
}
