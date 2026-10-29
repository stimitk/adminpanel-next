"use client";
import type { CSSProperties, ReactNode } from "react";

export interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  circle?: boolean;
  style?: CSSProperties;
}

export function Skeleton({
  className = "",
  width,
  height,
  borderRadius,
  circle = false,
  style,
}: SkeletonProps) {
  const inlineStyles: CSSProperties = {
    width: width !== undefined ? width : "100%",
    height: height !== undefined ? height : "18px",
    borderRadius: circle ? "50%" : borderRadius !== undefined ? borderRadius : "6px",
    ...style,
  };

  return (
    <div
      className={`skeleton-box ${className}`.trim()}
      style={inlineStyles}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`skeleton-text-group ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 && lines > 1 ? "70%" : "100%"}
          style={{ marginBottom: 8 }}
        />
      ))}
    </div>
  );
}

export function SkeletonHeader({
  withAction = true,
}: {
  withAction?: boolean;
}) {
  return (
    <div className="page-heading skeleton-header" aria-hidden="true">
      <div style={{ flex: 1 }}>
        <Skeleton width="220px" height="32px" style={{ marginBottom: 8 }} />
        <Skeleton width="340px" height="14px" />
      </div>
      {withAction && <Skeleton width="160px" height="42px" borderRadius="6px" />}
    </div>
  );
}

export function SkeletonMetric() {
  return (
    <div className="metric skeleton" aria-hidden="true">
      <Skeleton width="24px" height="24px" circle />
      <Skeleton width="90px" height="14px" style={{ margin: "6px 0" }} />
      <Skeleton width="60%" height="28px" style={{ margin: "4px 0" }} />
      <Skeleton width="110px" height="12px" style={{ marginTop: 6 }} />
    </div>
  );
}

export function SkeletonCard({
  children,
  height,
  className = "",
  style,
}: {
  children?: ReactNode;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`paper skeleton-card ${className}`.trim()}
      style={{ minHeight: height, ...style }}
      aria-hidden="true"
    >
      {children || (
        <>
          <Skeleton width="40%" height="22px" style={{ marginBottom: 16 }} />
          <SkeletonText lines={4} />
        </>
      )}
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="table-scroll skeleton-table" aria-hidden="true">
      <table>
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <Skeleton width={`${60 + ((i * 17) % 30)}%`} height="14px" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c}>
                  <Skeleton
                    width={`${45 + (((r + c) * 23) % 45)}%`}
                    height="16px"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonPage({
  withHeader = true,
  withAction = true,
  withMetrics = false,
  cards = 1,
}: {
  withHeader?: boolean;
  withAction?: boolean;
  withMetrics?: boolean;
  cards?: number;
}) {
  return (
    <div className="skeleton-page" aria-busy="true" aria-label="Loading page content">
      {withHeader && <SkeletonHeader withAction={withAction} />}
      {withMetrics && (
        <section className="metrics" style={{ marginBottom: 24 }}>
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
        </section>
      )}
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} style={{ marginBottom: 20 }}>
          <Skeleton width="30%" height="20px" style={{ marginBottom: 16 }} />
          <SkeletonTable rows={4} columns={4} />
        </SkeletonCard>
      ))}
    </div>
  );
}
