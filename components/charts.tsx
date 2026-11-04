"use client";
import type { ReactNode } from "react";
import { Skeleton, Tooltip } from "./ui";

// Lightweight, dependency-free charts in the panel's visual language.
// Series colours are validated for colour-vision deficiency (see globals.css
// --series-1/--series-2); every chart also has the detailed table below it.

export type Bar = {
  key: string;
  label: string;
  detail?: string;
  value: number;
  tooltip: string;
  onClick?: () => void;
};

// Horizontal bars for comparing one measure across named items.
export function BarList({
  bars,
  max,
  format,
  empty = "No data for these filters.",
}: {
  bars: Bar[];
  max?: number;
  format: (value: number) => string;
  empty?: string;
}) {
  if (!bars.length) return <p className="muted chart-empty">{empty}</p>;
  const top = max ?? Math.max(1, ...bars.map((b) => b.value));
  return (
    <ul className="bar-list">
      {bars.map((bar) => (
        <li key={bar.key}>
          <span className="bar-label">
            {bar.onClick ? (
              <button type="button" className="text-button" onClick={bar.onClick} title={`Filter by ${bar.label}`}>
                {bar.label}
              </button>
            ) : (
              bar.label
            )}
            {bar.detail && <small>{bar.detail}</small>}
          </span>
          <Tooltip label={bar.tooltip} className="bar-track-anchor">
            <span className="bar-track" tabIndex={0} aria-label={bar.tooltip}>
              <span className="bar-fill" style={{ width: `${Math.max(1, (bar.value / top) * 100)}%` }} />
            </span>
          </Tooltip>
          <span className="bar-value">{format(bar.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export type StackedBar = {
  key: string;
  label: string;
  detail?: string;
  segments: { value: number; tooltip: string }[];
};

// Two-part bars (e.g. correct vs incorrect) with a legend; both shares are labelled.
export function StackedBarList({
  bars,
  series,
  empty = "No data for these filters.",
  total,
}: {
  bars: StackedBar[];
  series: string[];
  empty?: string;
  total: (bar: StackedBar) => ReactNode;
}) {
  if (!bars.length) return <p className="muted chart-empty">{empty}</p>;
  const top = Math.max(1, ...bars.map((b) => b.segments.reduce((t, s) => t + s.value, 0)));
  return (
    <>
      <ul className="chart-legend" aria-label="Legend">
        {series.map((name, i) => (
          <li key={name}>
            <span className={`legend-swatch series-${i + 1}`} aria-hidden="true" />
            {name}
          </li>
        ))}
      </ul>
      <ul className="bar-list">
        {bars.map((bar) => (
          <li key={bar.key}>
            <span className="bar-label">
              {bar.label}
              {bar.detail && <small>{bar.detail}</small>}
            </span>
            <span className="bar-track stacked">
              {bar.segments.map((segment, i) =>
                segment.value > 0 ? (
                  <Tooltip
                    key={i}
                    label={segment.tooltip}
                    className="bar-segment"
                    style={{ width: `${(segment.value / top) * 100}%` }}
                  >
                    <span
                      className={`bar-fill series-${i + 1}`}
                      tabIndex={0}
                      aria-label={segment.tooltip}
                    />
                  </Tooltip>
                ) : null,
              )}
            </span>
            <span className="bar-value">{total(bar)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// Daily columns for a count over time, with the first and last dates under the axis.
export function ColumnChart({
  points,
  label,
  start,
  end,
  empty = "No activity in this date range.",
}: {
  points: { key: string; value: number; tooltip: string }[];
  label: string;
  start?: string;
  end?: string;
  empty?: string;
}) {
  if (!points.length) return <p className="muted chart-empty">{empty}</p>;
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <figure className="column-chart" aria-label={label}>
      <span className="column-max">{max.toLocaleString()}</span>
      <div className="column-plot">
        {points.map((p) => (
          <Tooltip key={p.key} label={p.tooltip} className="column-anchor">
            <span className="column-hit" tabIndex={0} aria-label={p.tooltip}>
              <span className="column" style={{ height: `${(p.value / max) * 100}%` }} />
            </span>
          </Tooltip>
        ))}
      </div>
      {(start || end) && (
        <figcaption className="column-axis">
          <span>{start}</span>
          <span>{end}</span>
        </figcaption>
      )}
    </figure>
  );
}

export type Stat = {
  label: string;
  value: ReactNode;
  // Unit or base shown small after the value, e.g. "/ 20".
  suffix?: ReactNode;
  // How the figure is calculated; shown on hover of the label.
  definition?: string;
};

// A single row of equal key-figure cards: label and value only.
export function KpiCards({
  label,
  stats,
  loading = false,
}: {
  label: string;
  stats: Stat[];
  loading?: boolean;
}) {
  return (
    <dl className="kpi-row" aria-label={label} aria-busy={loading}>
      {stats.map((stat) => (
        <div className="kpi-card" key={stat.label}>
          <dt title={stat.definition}>{stat.label}</dt>
          <dd>
            {loading ? (
              <Skeleton width="60%" height="28px" />
            ) : (
              <>
                {stat.value}
                {stat.suffix && <small> {stat.suffix}</small>}
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
