"use client";
import { Button } from "./button";

export const PAGE_SIZES = [10, 25, 50, 100];

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  disabled?: boolean;
}

export function Pagination({ page, pageSize, total, onPage, onPageSize, disabled }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  if (!total) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      {onPageSize && (
        <label className="page-size">
          Rows per page
          <select
            value={pageSize}
            disabled={disabled}
            onChange={(e) => onPageSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      )}
      <span role="status">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <Button size="sm" variant="secondary" disabled={disabled || page <= 1} onClick={() => onPage(1)} aria-label="First page">
        «
      </Button>
      <Button size="sm" variant="secondary" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span>
        Page {page} of {pages.toLocaleString()}
      </span>
      <Button size="sm" variant="secondary" disabled={disabled || page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
      <Button size="sm" variant="secondary" disabled={disabled || page >= pages} onClick={() => onPage(pages)} aria-label="Last page">
        »
      </Button>
    </nav>
  );
}
