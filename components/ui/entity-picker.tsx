"use client";
import { useEffect, useId, useRef, useState } from "react";
import { errorText } from "../../lib/api";
import { ActionIcon } from "./icon-button";

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export type PickerOption = {
  value: string;
  label: string;
  // Secondary line, e.g. the teacher ID that tells same-named teachers apart.
  detail?: string;
};

export interface EntityPickerProps {
  label: string;
  placeholder?: string;
  value: PickerOption | null;
  onChange: (option: PickerOption | null) => void;
  // Fetches at most a handful of matches, so large lists are never loaded whole.
  load: (query: string, signal: AbortSignal) => Promise<PickerOption[]>;
  disabled?: boolean;
}

// Searchable select backed by the server.
export function EntityPicker({ label, placeholder = "Type to search", value, onChange, load, disabled }: EntityPickerProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PickerOption[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounced = useDebounced(query, 250);
  const loader = useRef(load);
  loader.current = load;
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    loader
      .current(debounced.trim(), controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setOptions(list);
        setActive(0);
      })
      .catch((e) => !controller.signal.aborted && setError(errorText(e)))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [debounced, open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function choose(option: PickerOption) {
    onChange(option);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="entity-picker" ref={box}>
      <label htmlFor={id}>{label}</label>
      {value ? (
        <div className="entity-picker-value">
          <span>
            <strong>{value.label}</strong>
            {value.detail && <small>{value.detail}</small>}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label={`Clear ${label.toLowerCase()}`}
            title={`Clear ${label.toLowerCase()}`}
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            <ActionIcon name="close" size={14} />
          </button>
        </div>
      ) : (
        <input
          id={id}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(options.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter" && open && options[active]) {
              e.preventDefault();
              choose(options[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
      )}
      {open && !value && (
        <ul className="entity-picker-list" id={`${id}-list`} role="listbox">
          {loading ? (
            <li className="entity-picker-note">Searching…</li>
          ) : error ? (
            <li className="entity-picker-note">{error}</li>
          ) : options.length ? (
            options.map((option, i) => (
              <li
                key={option.value}
                role="option"
                aria-selected={i === active}
                className={i === active ? "is-active" : undefined}
                onPointerDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <strong>{option.label}</strong>
                {option.detail && <small>{option.detail}</small>}
              </li>
            ))
          ) : (
            <li className="entity-picker-note">
              {debounced.trim() ? `No matches for “${debounced.trim()}”` : "No options"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
