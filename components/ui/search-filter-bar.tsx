"use client";
import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { ActionIcon } from "./icon-button";

export type FilterChip = { key: string; label: string; clear: () => void };

// One search box with a Filters button; filters fold out below and active
// search/filters show as removable chips.
export function SearchFilterBar({
  value,
  onChange,
  placeholder,
  label = "Search",
  chips,
  filterCount,
  onClearFilters,
  onClearAll,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
  chips: FilterChip[];
  // Number of filters set inside the panel (shown on the button).
  filterCount: number;
  // Clear filters keeps the search text; Clear all removes it too.
  onClearFilters: () => void;
  onClearAll: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <form className="search-panel compact" role="search" onSubmit={(e) => e.preventDefault()}>
      <div className="search-bar">
        <span className="search-input">
          <ActionIcon name="search" />
          <input
            type="search"
            aria-label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={100}
          />
        </span>
        <Button
          type="button"
          variant="secondary"
          className="filter-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <ActionIcon name="filter" />
          Filters
          {filterCount > 0 && <span className="filter-count">{filterCount}</span>}
        </Button>
      </div>
      {open && (
        <div className="filter-panel">
          <div className="filter-panel-fields">{children}</div>
          <div className="filter-panel-actions">
            <Button size="sm" variant="text" disabled={!filterCount} onClick={onClearFilters}>
              Clear filters
            </Button>
          </div>
        </div>
      )}
      {chips.length > 0 && (
        <div className="filter-chips" aria-label="Active filters">
          {chips.map((chip) => (
            <span className="filter-chip" key={chip.key}>
              {chip.label}
              <button type="button" aria-label={`Remove filter ${chip.label}`} onClick={chip.clear}>
                <ActionIcon name="close" size={12} />
              </button>
            </span>
          ))}
          <Button size="sm" variant="text" onClick={onClearAll}>
            Clear all
          </Button>
        </div>
      )}
    </form>
  );
}
