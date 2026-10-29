"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, errorText, rowsOf } from "../lib/api";
import { csvTemplate, parseCsv, validateQuestions } from "../lib/import";
import type { Row } from "../lib/types";
import { DataTable, Heading, Notice, useLoad } from "./ui";
type ImportRow = {
  question: Row;
  status: "Ready" | "Saved" | "Failed" | "Review";
  error?: string;
};
export function BulkImport({
  setId,
  setName,
  embedded = false,
  onImported,
  onBusyChange,
}: {
  setId?: string;
  setName?: string;
  embedded?: boolean;
  onImported?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const labels = useLoad<unknown>(setId ? null : "/questions/labels");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function template() {
    const url = URL.createObjectURL(
      new Blob([csvTemplate], { type: "text/csv" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kgamify-question-template.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function preview() {
    if (!file) return;
    setError("");
    setRows([]);
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Choose a file smaller than 5 MB.");
      const text = await file.text();
      const parsed = file.name.toLowerCase().endsWith(".json")
        ? JSON.parse(text)
        : parseCsv(text);
      if (
        !Array.isArray(parsed) ||
        parsed.some(
          (row) => !row || typeof row !== "object" || Array.isArray(row),
        )
      )
        throw new Error(
          "The JSON file must contain an array of question objects.",
        );
      setRows(
        validateQuestions(
          setId ? parsed.map((row) => ({ ...row, labelId: setId })) : parsed,
          label,
        ).map((question) => ({
          question,
          status: "Ready",
        })),
      );
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function run() {
    setError("");
    setBusy(true);
    onBusyChange?.(true);
    controller.current = new AbortController();
    const next = rows.map((row) => ({ ...row }));
    try {
      for (let i = 0; i < next.length; i++) {
        if (next[i].status === "Saved" || next[i].status === "Review") continue;
        if (controller.current.signal.aborted) break;
        try {
          await api("/questions/", {
            method: "POST",
            body: next[i].question,
            signal: controller.current.signal,
          });
          next[i].status = "Saved";
          next[i].error = undefined;
        } catch (e) {
          // A lost response may hide a committed write. Never automatically resend it.
          const uncertain =
            !(e instanceof ApiError) || e.status === 0 || e.status >= 500;
          next[i].status = uncertain ? "Review" : "Failed";
          next[i].error = errorText(e);
          if (
            uncertain ||
            (e instanceof ApiError && [401, 403, 429].includes(e.status))
          ) {
            setError(
              uncertain
                ? "Import paused. A request may have been saved without a response. Check the question bank before importing that row again."
                : errorText(e),
            );
            break;
          }
        }
        setRows(next.map((row) => ({ ...row })));
      }
    } finally {
      setRows(next);
      setBusy(false);
      onBusyChange?.(false);
      if (next.some((row) => row.status === "Saved")) onImported?.();
    }
  }
  const saved = rows.filter((row) => row.status === "Saved").length;
  return (
    <>
      {embedded ? (
        <div className="section-heading">
          <h3>Import questions</h3>
          <button className="secondary small" onClick={template}>
            Download CSV template
          </button>
        </div>
      ) : (
        <Heading
          title="Bulk Importer"
          description="Preview your questions, then add them to the question bank."
          action={
            <button className="secondary" onClick={template}>
              Download CSV template
            </button>
          }
        />
      )}
      <section className={embedded ? "import-content" : "paper"}>
        {setId && (
          <p>
            All imported questions will be added to{" "}
            <strong>{setName || "the selected question set"}</strong>.
          </p>
        )}
        <p>
          Upload CSV or JSON using the question field names in the template.
          PDF, Word and spreadsheet extraction is not available in this
          frontend.
        </p>
        {error && <Notice>{error}</Notice>}
        {labels.error && <Notice>{labels.error}</Notice>}
        <fieldset disabled={busy} className="form-grid">
          {!setId && (
            <div className="field">
              <label htmlFor="import-label">Default question set</label>
              <select
                id="import-label"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  setRows([]);
                }}
              >
                <option value="">Use labelId from each row</option>
                {rowsOf(labels.data).map((row) => (
                  <option
                    key={String(row.label_id)}
                    value={String(row.label_id)}
                  >
                    {String(row.label_name)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="import-file">
              Question file (CSV or JSON, up to 5 MB)
            </label>
            <input
              id="import-file"
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setRows([]);
                setError("");
              }}
            />
          </div>
        </fieldset>
        <div className="form-actions">
          <button disabled={!file || busy} onClick={preview}>
            Preview file
          </button>
          {rows.length > 0 && (
            <button
              disabled={
                busy ||
                rows.every(
                  (row) => row.status === "Saved" || row.status === "Review",
                )
              }
              onClick={run}
            >
              {busy ? "Importing…" : "Import remaining questions"}
            </button>
          )}
          {busy && (
            <button
              className="secondary"
              onClick={() => controller.current?.abort()}
            >
              Stop import
            </button>
          )}
        </div>
        {rows.length > 0 && (
          <>
            <p role="status">
              {saved} of {rows.length} questions saved.
            </p>
            <progress
              value={saved}
              max={rows.length}
              aria-label="Questions imported"
            />
            <DataTable
              rows={rows.map((row) => ({
                ...row.question,
                import_status: row.status,
                import_error: row.error,
              }))}
              columns={[
                ["questionText", "Question"],
                ["labelId", "Question set"],
                ["correctAnswer", "Correct option"],
                ["import_status", "Import status"],
                ["import_error", "Message"],
              ]}
            />
          </>
        )}
      </section>
    </>
  );
}
