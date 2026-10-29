"use client";
import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { RichTextEditor } from "../rich-text-editor";
import { plainRichText, sanitizeRichText } from "../../lib/rich-text";
import { api, asId, errorText, rowsOf } from "../../lib/api";
import { resources } from "../../lib/resources";
import type { Field, Option } from "../../lib/types";
import { Notice } from "../ui/notice";
import { display } from "../ui/form-controls";
import { Button } from "../ui/button";

export interface StandardFormProps {
  fields: Field[];
  initial?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  submitLabel?: string;
  successMessage?: string;
  secondaryAction?: ReactNode;
  extraContent?: ReactNode;
  submitDisabled?: boolean;
  disabled?: boolean;
}

export function StandardForm({
  fields,
  initial = {},
  onSubmit,
  submitLabel = "Save",
  successMessage = "Saved successfully.",
  secondaryAction,
  extraContent,
  submitDisabled = false,
  disabled = false,
}: StandardFormProps) {
  const formId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lookups, setLookups] = useState<Record<string, Option[]>>({});
  const [lookupErrors, setLookupErrors] = useState<string[]>([]);
  const sources = Array.from(
    new Set(fields.map((f) => f.source).filter((s): s is string => !!s)),
  )
    .sort()
    .join(",");
  const [loadingLookups, setLoadingLookups] = useState(!!sources);
  const [lookupRevision, setLookupRevision] = useState(0);

  useEffect(() => {
    if (!sources) {
      setLoadingLookups(false);
      return;
    }
    const controller = new AbortController();
    setLoadingLookups(true);
    setLookupErrors([]);
    const keys = sources.split(",");
    Promise.allSettled(
      keys.map(async (key) => {
        const data = await api(resources[key].endpoint, {
          signal: controller.signal,
        });
        return {
          key,
          options: rowsOf(data).map((row) => {
            const id =
              row.label_id ??
              row.category_id ??
              row.institute_id ??
              row.company_id ??
              row.id;
            return {
              value: String(id),
              label: display(
                row.label_name ??
                  row.category_name ??
                  row.institute_name ??
                  row.company_name ??
                  row.name,
              ),
            };
          }),
        };
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const errors: string[] = [];
      const values: Record<string, Option[]> = {};
      results.forEach((result, i) => {
        if (result.status === "fulfilled")
          values[result.value.key] = result.value.options;
        else
          errors.push(
            `${resources[keys[i]].title}: ${errorText(result.reason)}`,
          );
      });
      setLookups(values);
      setLookupErrors(errors);
      setLoadingLookups(false);
    });
    return () => controller.abort();
  }, [sources, lookupRevision]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || disabled) return;
    const data = new FormData(event.currentTarget);
    const values: Record<string, unknown> = {};
    fields.forEach((field) => {
      if (field.type === "multiselect")
        values[field.name] = data
          .getAll(field.name)
          .map((v) => asId(String(v)));
      else {
        const raw = String(data.get(field.name) || "");
        const value = field.type === "password" ? raw : raw.trim();
        if (value !== "")
          values[field.name] = field.name.endsWith("Id")
            ? asId(value)
            : field.type === "number"
              ? Number(value)
              : value;
      }
    });

    for (const field of fields) {
      if (field.type === "richtext") {
        const value = String(values[field.name] || "");
        if (field.required && !plainRichText(value)) {
          setError(`${field.label} is required.`);
          const editor = event.currentTarget.querySelector<HTMLElement>(
            '[contenteditable="true"]',
          );
          editor?.focus();
          return;
        }
        values[field.name] = sanitizeRichText(value);
      }
    }

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await onSubmit(values);
      setSuccess(successMessage);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="editor-form">
      {error && <Notice kind="error">{error}</Notice>}
      {success && <Notice kind="success">{success}</Notice>}
      {lookupErrors.length > 0 && (
        <Notice kind="error">
          {lookupErrors.join(" ")}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => setLookupRevision((v) => v + 1)}
          >
            Retry loading choices
          </button>
        </Notice>
      )}
      <fieldset disabled={busy || disabled} className="form-grid">
        {fields.map((field) => {
          const id = `${formId}-${field.name}`;
          const help = `${id}-help`;
          const opts =
            field.options || (field.source ? lookups[field.source] || [] : []);
          const value = initial[field.name] ?? field.value ?? "";
          const common = {
            id,
            name: field.name,
            required: field.required,
            "aria-describedby": field.hint ? help : undefined,
          };
          return (
            <div
              className={`field ${field.type === "textarea" || field.type === "richtext" ? "field-wide" : ""}`}
              key={field.name}
            >
              <label
                htmlFor={id}
                onClick={
                  field.type === "richtext"
                    ? () => document.getElementById(id)?.focus()
                    : undefined
                }
              >
                {field.label}
                {field.required && <span aria-hidden="true"> *</span>}
              </label>
              {field.type === "richtext" ? (
                <RichTextEditor
                  id={id}
                  name={field.name}
                  label={field.label}
                  initial={String(value)}
                  disabled={busy || disabled}
                  required={field.required}
                  describedBy={field.hint ? help : undefined}
                />
              ) : field.type === "textarea" ? (
                <textarea
                  {...common}
                  rows={4}
                  defaultValue={String(value)}
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                />
              ) : field.type === "select" || field.type === "multiselect" ? (
                <select
                  key={`${field.name}-${loadingLookups ? "loading" : "ready"}-${lookupRevision}`}
                  {...common}
                  multiple={field.type === "multiselect"}
                  size={field.type === "multiselect" ? 4 : undefined}
                  defaultValue={
                    field.type === "multiselect"
                      ? Array.isArray(value)
                        ? value.map(String)
                        : []
                      : String(value)
                  }
                  disabled={!!field.source && loadingLookups}
                >
                  {field.type === "select" && (
                    <option value="">
                      {loadingLookups && field.source
                        ? "Loading choices…"
                        : `Select ${field.label.toLowerCase()}`}
                    </option>
                  )}
                  {opts.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  {...common}
                  type={field.type || "text"}
                  defaultValue={String(value)}
                  min={field.min}
                  max={field.max}
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                  autoComplete={
                    field.type === "password" ? "new-password" : undefined
                  }
                />
              )}{" "}
              {field.hint && <small id={help}>{field.hint}</small>}
              {field.source &&
                !loadingLookups &&
                !lookupErrors.length &&
                !opts.length && (
                  <small>
                    No choices available. Add a {field.label.toLowerCase()}{" "}
                    first.
                  </small>
                )}
            </div>
          );
        })}
        {extraContent}
      </fieldset>
      <div className="form-actions">
        <Button
          type="submit"
          loading={busy}
          disabled={
            disabled ||
            submitDisabled ||
            loadingLookups ||
            lookupErrors.length > 0
          }
        >
          {submitLabel}
        </Button>
        {secondaryAction ?? (
          <Link className="button secondary" href="/dashboard">
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
