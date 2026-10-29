"use client";
import type { ReactNode } from "react";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  color?: string;
}

export function Spinner({ size = "md", className = "", color }: SpinnerProps) {
  const sizePx = size === "sm" ? 14 : size === "lg" ? 28 : 18;
  const strokeWidth = size === "sm" ? 2 : size === "lg" ? 3 : 2.5;

  return (
    <span
      className={`spinner ${className}`.trim()}
      style={{
        width: sizePx,
        height: sizePx,
        borderWidth: strokeWidth,
        borderTopColor: color,
        display: "inline-block",
      }}
      aria-hidden="true"
    />
  );
}

export interface LoadingProps {
  text?: ReactNode;
  size?: "sm" | "md" | "lg";
  inline?: boolean;
  className?: string;
}

export function Loading({
  text = "Loading…",
  size = "md",
  inline = false,
  className = "",
}: LoadingProps) {
  return (
    <div
      className={`loading ${inline ? "loading-inline" : ""} ${className}`.trim()}
      role="status"
    >
      <Spinner size={size} />
      {text && <span>{text}</span>}
    </div>
  );
}
