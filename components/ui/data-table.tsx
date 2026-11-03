"use client";
import { useState, type ReactNode } from "react";
import { isRichColumn, plainRichText } from "../../lib/rich-text";
import type { Row } from "../../lib/types";
import { RichText } from "../rich-text-editor";
import { StatusBadge } from "./badge";
import { display } from "./form-controls";
import { SkeletonTable } from "./skeleton";
import { EmptyState } from "./empty-state";
import { ActionIcon } from "./icon-button";
import { Pagination } from "./pagination";

// Put this key in `columns` to place the Actions column there instead of last.
export const ACTIONS_COLUMN = "@actions";
// Serial number column ("S.No."), numbered after search and sorting.
export const SERIAL_COLUMN = "@serial";

export type SortState = { key: string; dir: "asc" | "desc" };

export interface DataTableProps {
  rows: Row[];
  columns: [string, string][];
  actions?: (row: Row) => ReactNode;
  statusKind?: "teacher" | "default";
  loading?: boolean;
  emptyMessage?: string;
  emptyDescription?: ReactNode;
  searchPlaceholder?: string;
  // Custom cell content by column key; search still matches the raw row value.
  render?: Record<string, (row: Row) => ReactNode>;
  rowClassName?: (row: Row) => string | undefined;
  selection?: {
    selected: string[];
    onChange: (ids: string[]) => void;
    rowId: (row: Row) => string;
    rowLabel?: (row: Row) => string;
    // Visible column heading and what a checked box means, e.g. "Include".
    title?: string;
    disabled?: boolean;
    isDisabled?: (row: Row) => boolean;
  };
  // Adds an S.No. column first (or where SERIAL_COLUMN is placed).
  serial?: boolean;
  // Added to serial numbers when rows are one server-side page.
  serialOffset?: number;
  // Column keys that can be sorted by clicking their heading, or `true` for all.
  sortable?: string[] | true;
  // Value to sort by when the displayed cell differs from the raw value.
  sortValue?: Record<string, (row: Row) => string | number>;
  defaultSort?: SortState;
  // Client-side page size; 0 shows every row (for server-paginated data).
  pageSize?: number;
  // Hide the built-in search when the page filters on the server.
  searchable?: boolean;
  // Extra controls shown in the toolbar beside the search field.
  toolbar?: ReactNode;
  rowKey?: (row: Row) => string;
}

function compareValues(a: unknown, b: unknown) {
  const empty = (v: unknown) => v === null || v === undefined || v === "";
  if (empty(a) || empty(b)) return empty(a) ? (empty(b) ? 0 : 1) : -1;
  const x = Number(a),
    y = Number(b);
  if (Number.isFinite(x) && Number.isFinite(y)) return x - y;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function DataTable({
  rows,
  columns: requested,
  actions,
  statusKind,
  loading = false,
  emptyMessage,
  emptyDescription,
  searchPlaceholder = "Search…",
  render,
  rowClassName,
  selection,
  serial = false,
  serialOffset = 0,
  sortable,
  sortValue,
  defaultSort,
  pageSize: initialPageSize = 25,
  searchable = true,
  toolbar,
  rowKey,
}: DataTableProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState | null>(defaultSort || null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const dataColumns = requested.filter(
    ([key]) => key !== ACTIONS_COLUMN && key !== SERIAL_COLUMN,
  );
  let columns: [string, string][] = actions
    ? requested.some(([key]) => key === ACTIONS_COLUMN)
      ? requested
      : [...requested, [ACTIONS_COLUMN, "Actions"]]
    : requested.filter(([key]) => key !== ACTIONS_COLUMN);
  if (serial && !columns.some(([key]) => key === SERIAL_COLUMN))
    columns = [[SERIAL_COLUMN, "S.No."], ...columns];
  const span = columns.length + (selection ? 1 : 0);
  const canSort = (key: string) =>
    key !== ACTIONS_COLUMN &&
    key !== SERIAL_COLUMN &&
    (sortable === true || !!sortable?.includes(key));

  if (loading) {
    return <SkeletonTable rows={5} columns={span} />;
  }

  const matched = search
    ? rows.filter((row) =>
        dataColumns.some(([key]) =>
          (isRichColumn(key) ? plainRichText(row[key]) : display(row[key]))
            .toLowerCase()
            .includes(search.toLowerCase()),
        ),
      )
    : rows;
  const sorted = sort
    ? [...matched].sort((a, b) => {
        const value = (row: Row) =>
          sortValue?.[sort.key] ? sortValue[sort.key](row) : row[sort.key];
        const order = compareValues(value(a), value(b));
        return sort.dir === "asc" ? order : -order;
      })
    : matched;
  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const currentPage = Math.min(page, pages);
  const start = pageSize ? (currentPage - 1) * pageSize : 0;
  const filtered = pageSize ? sorted.slice(start, start + pageSize) : sorted;

  function toggleSort(key: string) {
    setSort((current) =>
      current?.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
    setPage(1);
  }

  const selectable = (row: Row) =>
    !!selection && !selection.isDisabled?.(row);
  const visibleIds = selection
    ? filtered.filter(selectable).map(selection.rowId)
    : [];
  const checkedVisible = selection
    ? visibleIds.filter((id) => selection.selected.includes(id)).length
    : 0;
  function toggleAll(checked: boolean) {
    if (!selection) return;
    selection.onChange(
      checked
        ? [...new Set([...selection.selected, ...visibleIds])]
        : selection.selected.filter((id) => !visibleIds.includes(id)),
    );
  }
  function toggle(id: string, checked: boolean) {
    if (!selection) return;
    selection.onChange(
      checked
        ? [...new Set([...selection.selected, id])]
        : selection.selected.filter((value) => value !== id),
    );
  }
  function cell(row: Row, key: string, index: number) {
    if (key === SERIAL_COLUMN) return serialOffset + start + index + 1;
    if (key === ACTIONS_COLUMN)
      return <div className="row-actions">{actions?.(row)}</div>;
    if (render?.[key]) return render[key](row);
    if (key === "status")
      return <StatusBadge status={row[key]} kind={statusKind} />;
    if (!isRichColumn(key)) return display(row[key]);
    const imageKey =
      key === "question_text"
        ? "question_image"
        : key === "questionText"
          ? "questionImage"
          : key.replace(/_text$/, "_img").replace(/Text$/, "Img");
    const src = String(row[imageKey] || "");
    return (
      <>
        <RichText value={row[key]} />
        {/^(https?:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(src) && (
          <img
            className="question-table-image"
            src={src}
            alt="Attached question or answer image"
            loading="lazy"
          />
        )}
      </>
    );
  }
  const cellClass = (key: string) =>
    key === ACTIONS_COLUMN
      ? "actions-cell"
      : key === SERIAL_COLUMN
        ? "serial-cell"
        : undefined;

  return (
    <>
      {(searchable || toolbar) && (
        <div className="table-toolbar">
          {searchable && (
            <label>
              Search records
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
              />
            </label>
          )}
          {toolbar && <div className="table-toolbar-extra">{toolbar}</div>}
          <span>
            {sorted.length.toLocaleString()}{" "}
            {sorted.length === 1 ? "record" : "records"}
          </span>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {selection && (
                <th scope="col" className="select-cell">
                  <input
                    type="checkbox"
                    aria-label={
                      selection.title
                        ? `${selection.title}: all visible rows`
                        : "Select all visible rows"
                    }
                    disabled={selection.disabled || !visibleIds.length}
                    checked={
                      visibleIds.length > 0 &&
                      checkedVisible === visibleIds.length
                    }
                    ref={(input) => {
                      if (input)
                        input.indeterminate =
                          checkedVisible > 0 &&
                          checkedVisible < visibleIds.length;
                    }}
                    onChange={(event) => toggleAll(event.target.checked)}
                  />
                  {selection.title && (
                    <span className="select-cell-title">{selection.title}</span>
                  )}
                </th>
              )}
              {columns.map(([key, label]) => (
                <th
                  key={key}
                  scope="col"
                  className={cellClass(key)}
                  aria-sort={
                    sort?.key === key
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {canSort(key) ? (
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => toggleSort(key)}
                      title={`Sort by ${label}`}
                    >
                      {label}
                      <ActionIcon
                        size={12}
                        name={
                          sort?.key === key
                            ? sort.dir === "asc"
                              ? "sort-asc"
                              : "sort-desc"
                            : "sort"
                        }
                      />
                    </button>
                  ) : (
                    label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((row, i) => (
                <tr
                  key={
                    rowKey
                      ? rowKey(row)
                      : String(
                          row.attempt_id ||
                            row.question_id ||
                            row.champ_id ||
                            row.teacher_id ||
                            row.institute_id ||
                            row.company_id ||
                            row.label_id ||
                            row.id ||
                            i,
                        )
                  }
                  className={
                    [
                      selection?.selected.includes(selection.rowId(row)) &&
                        "is-selected",
                      rowClassName?.(row),
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                >
                  {selection && (
                    <td className="select-cell">
                      <input
                        type="checkbox"
                        aria-label={`${selection.title || "Select"} ${
                          selection.rowLabel?.(row) || "row"
                        }`}
                        disabled={selection.disabled || !selectable(row)}
                        checked={selection.selected.includes(
                          selection.rowId(row),
                        )}
                        onChange={(event) =>
                          toggle(selection.rowId(row), event.target.checked)
                        }
                      />
                    </td>
                  )}
                  {columns.map(([key]) => (
                    <td key={key} className={cellClass(key)}>
                      {cell(row, key, i)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={span} className="empty">
                  {search ? (
                    <EmptyState
                      title="No matching records"
                      description="Try another search term or clear the filter."
                    />
                  ) : (
                    <EmptyState
                      title={emptyMessage || "No records yet"}
                      description={
                        emptyDescription ||
                        "When records are created, they will appear here."
                      }
                    />
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pageSize > 0 && sorted.length > Math.min(pageSize, PAGE_SIZE_FLOOR) && (
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          total={sorted.length}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}
    </>
  );
}
// Pagination appears once rows exceed the smallest page size on offer.
const PAGE_SIZE_FLOOR = 10;
