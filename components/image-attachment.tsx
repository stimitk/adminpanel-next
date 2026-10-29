"use client";
import { useEffect, useId, useRef, useState } from "react";
import { errorText, uploadQuestionImage } from "../lib/api";
export function ImageAttachment({
  name,
  label,
  initial = "",
  disabled = false,
  onBlocked,
}: {
  name: string;
  label: string;
  initial?: string;
  disabled?: boolean;
  onBlocked: (blocked: boolean) => void;
}) {
  const [value, setValue] = useState(initial);
  const [expanded, setExpanded] = useState(!!initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState(initial);
  const [imageFailed, setImageFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const id = useId();
  useEffect(() => () => request.current?.abort(), []);
  async function select(file?: File) {
    if (!file || disabled) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError("");
    setExpanded(true);
    setImageFailed(false);
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        file.type,
      )
    ) {
      setError("Choose a PNG, JPG, WebP or GIF image.");
      onBlocked(true);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose an image smaller than 5 MB.");
      onBlocked(true);
      return;
    }
    setUploading(true);
    onBlocked(true);
    try {
      const url = await uploadQuestionImage(file, controller.signal);
      if (controller.signal.aborted) return;
      setValue(url);
      setLink(url);
      onBlocked(false);
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(errorText(error));
        onBlocked(true);
      }
    } finally {
      if (!controller.signal.aborted) setUploading(false);
    }
  }
  function clear() {
    request.current?.abort();
    setUploading(false);
    setValue("");
    setLink("");
    setError("");
    setImageFailed(false);
    onBlocked(false);
    if (input.current) input.current.value = "";
  }
  function useLink() {
    try {
      const url = new URL(link);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      request.current?.abort();
      setUploading(false);
      setValue(url.href);
      setError("");
      setImageFailed(false);
      onBlocked(false);
    } catch {
      setError("Enter a valid https:// or http:// image URL.");
      onBlocked(true);
    }
  }
  return (
    <div className="image-attachment">
      <input
        type="hidden"
        name={name}
        value={value}
        disabled={disabled}
        readOnly
      />
      <input
        ref={input}
        className="visually-hidden-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-label={`Upload ${label.toLowerCase()}`}
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void select(file);
        }}
      />
      {!expanded ? (
        <button
          type="button"
          className="image-add-button"
          disabled={disabled}
          onClick={() => {
            setExpanded(true);
            input.current?.click();
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="m3 16 5-5 5 5 3-3 5 5M16 7h.01" />
          </svg>
          Add image
        </button>
      ) : (
        <>
          <div
            className="image-dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!disabled && !uploading)
                void select(event.dataTransfer.files[0]);
            }}
          >
            {value && !imageFailed ? (
              <img
                className="attachment-preview"
                src={value}
                alt={label}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="image-drop-copy">
                <strong>
                  {uploading
                    ? "Uploading image…"
                    : imageFailed
                      ? "Image preview unavailable"
                      : "Drop an image here"}
                </strong>
                <span>
                  {imageFailed
                    ? "The image link may be unavailable. You can replace or remove it."
                    : "PNG, JPG, WebP or GIF · Up to 5 MB"}
                </span>
              </div>
            )}
            <div className="image-attachment-actions">
              <button
                type="button"
                className="small secondary"
                disabled={disabled || uploading}
                onClick={() => input.current?.click()}
              >
                {uploading
                  ? "Uploading…"
                  : value
                    ? "Replace image"
                    : "Choose image"}
              </button>
              <button
                type="button"
                className="small text-button"
                disabled={disabled}
                onClick={() => {
                  clear();
                  setExpanded(false);
                }}
              >
                {value || uploading ? "Remove" : "Cancel"}
              </button>
            </div>
          </div>
          {error && (
            <p className="attachment-error" role="alert">
              {error}
            </p>
          )}
          {uploading && (
            <p className="muted" role="status">
              Uploading… Wait for the image to finish before saving.
            </p>
          )}
          <details className="image-url-alternative">
            <summary>Use an image link instead</summary>
            <div className="image-link-row">
              <label htmlFor={id} className="sr-only">
                {label} URL
              </label>
              <input
                id={id}
                type="url"
                placeholder="https://…"
                value={link}
                disabled={disabled || uploading}
                onChange={(event) => setLink(event.target.value)}
              />
              <button
                type="button"
                className="small secondary"
                disabled={disabled || uploading || !link.trim()}
                onClick={useLink}
              >
                Use link
              </button>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
