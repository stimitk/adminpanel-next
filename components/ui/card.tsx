"use client";
import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: "section" | "div" | "article";
  className?: string;
}

export function Card({
  children,
  as: Component = "section",
  className = "",
  ...props
}: CardProps) {
  return (
    <Component className={`paper ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}

export function CardHeader({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  if (children) {
    return <div className={`card-header ${className}`.trim()}>{children}</div>;
  }

  return (
    <div
      className={`card-header ${action ? "has-action" : ""} ${className}`.trim()}
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 16,
      }}
    >
      <div>
        {title && <h2 style={{ margin: "0 0 4px" }}>{title}</h2>}
        {description && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="card-action">{action}</div>}
    </div>
  );
}

export function CardTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={`card-title ${className}`.trim()}>{children}</h2>;
}

export function CardDescription({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`card-description ${className}`.trim()}
      style={{ margin: "4px 0 16px", fontSize: 13, color: "var(--muted)" }}
    >
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card-content ${className}`.trim()}>{children}</div>;
}

export function CardFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`card-footer ${className}`.trim()}
      style={{
        marginTop: 20,
        paddingTop: 16,
        borderTop: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}
