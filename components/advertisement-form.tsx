"use client";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { errorText, uploadAdvertisementImage } from "../lib/api";
import { resources } from "../lib/resources";
import type { Row } from "../lib/types";
import { Form } from "./ui";

type Source = {
  image: HTMLImageElement;
  url: string;
  owned: boolean;
  width: number;
  height: number;
  filename: string;
};
function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}
function cropRect(
  source: Source,
  ratio: number,
  zoom: number,
  position: { x: number; y: number },
) {
  const width = Math.min(source.width, source.height * ratio) / zoom;
  const height = width / ratio;
  return {
    width,
    height,
    x: (source.width - width) * position.x,
    y: (source.height - height) * position.y,
  };
}
function AdvertisementImage({
  ratio,
  ratioLabel,
  disabled,
  onChange,
}: {
  ratio: number;
  ratioLabel: string;
  disabled: boolean;
  onChange: (url: string) => void;
}) {
  const [source, setSource] = useState<Source | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState("");
  const [link, setLink] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const id = useId();
  useEffect(
    () => () => {
      generation.current += 1;
      abort.current?.abort();
    },
    [],
  );
  useEffect(
    () => () => {
      if (source?.owned) URL.revokeObjectURL(source.url);
    },
    [source],
  );
  useEffect(() => {
    abort.current?.abort();
    setUploading(false);
    setZoom(1);
    setPosition({ x: 0.5, y: 0.5 });
    setUploaded("");
    setError("");
    onChange("");
    if (source) setCropOpen(true);
  }, [ratio]);
  useEffect(() => {
    if (!source || !dialog.current) return;
    const element = dialog.current;
    if (cropOpen) {
      const previousOverflow = document.body.style.overflow;
      element.showModal();
      document.body.style.overflow = "hidden";
      return () => {
        element.close();
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [cropOpen, source]);
  function closeCrop() {
    abort.current?.abort();
    setUploading(false);
    setCropOpen(false);
    drag.current = null;
  }
  const matching =
    !!source && Math.abs(source.width / source.height / ratio - 1) <= 0.002;
  const width = ratio < 2 ? 1280 : 1356,
    height = ratio < 2 ? 720 : 200;
  useEffect(() => {
    if (!source || !canvas.current) return;
    const context = canvas.current.getContext("2d");
    if (!context) return;
    const crop = cropRect(source, ratio, zoom, position);
    context.clearRect(0, 0, width, height);
    context.drawImage(
      source.image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      width,
      height,
    );
  }, [source, ratio, zoom, position, width, height]);
  function changed() {
    setUploaded("");
    onChange("");
  }
  async function load(url: string, owned: boolean, filename: string) {
    const version = ++generation.current;
    abort.current?.abort();
    setUploading(false);
    setLoading(true);
    setError("");
    setSource(null);
    changed();
    try {
      const image = new Image();
      if (!owned) image.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () =>
          reject(
            new Error(
              owned
                ? "This image cannot be opened. Choose another file."
                : "This image cannot be loaded for cropping. Download it and choose the file instead.",
            ),
          );
        image.src = url;
      });
      if (version !== generation.current) {
        if (owned) URL.revokeObjectURL(url);
        return;
      }
      if (!image.naturalWidth || !image.naturalHeight)
        throw new Error("The image has no readable dimensions.");
      setSource({
        image,
        url,
        owned,
        width: image.naturalWidth,
        height: image.naturalHeight,
        filename,
      });
      setZoom(1);
      setPosition({ x: 0.5, y: 0.5 });
      setCropOpen(true);
    } catch (error) {
      if (owned) URL.revokeObjectURL(url);
      if (version === generation.current) setError(errorText(error));
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }
  function choose(file?: File) {
    if (!file || disabled || uploading) return;
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        file.type,
      )
    ) {
      setError("Choose a PNG, JPG, WebP or GIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose an image smaller than 5 MB.");
      return;
    }
    void load(URL.createObjectURL(file), true, file.name);
  }
  async function upload() {
    if (!canvas.current || !source || disabled || uploading) return;
    const controller = new AbortController();
    abort.current = controller;
    setUploading(true);
    setError("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.current!.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(
                  new Error(
                    "The image could not be cropped. Choose another image.",
                  ),
                ),
          "image/png",
        ),
      );
      if (controller.signal.aborted) return;
      const stem =
        source.filename
          .replace(/\.[^.]*$/, "")
          .replace(/[^\w-]/g, "-")
          .slice(0, 60) || "advertisement";
      const url = await uploadAdvertisementImage(
        new File([blob], `${stem}-cropped.png`, { type: "image/png" }),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setUploaded(url);
      onChange(url);
      setCropOpen(false);
    } catch (error) {
      if (!controller.signal.aborted) setError(errorText(error));
    } finally {
      if (!controller.signal.aborted) setUploading(false);
    }
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || !source || disabled || uploading) return;
    const frame = event.currentTarget.getBoundingClientRect();
    const crop = cropRect(source, ratio, zoom, position);
    const dx = event.clientX - drag.current.x,
      dy = event.clientY - drag.current.y;
    drag.current = { x: event.clientX, y: event.clientY };
    setPosition((value) => ({
      x: clamp(
        value.x -
          ((dx / frame.width) * crop.width) /
            Math.max(1, source.width - crop.width),
      ),
      y: clamp(
        value.y -
          ((dy / frame.height) * crop.height) /
            Math.max(1, source.height - crop.height),
      ),
    }));
    changed();
  }
  function clear() {
    generation.current += 1;
    abort.current?.abort();
    setCropOpen(false);
    setSource(null);
    setLoading(false);
    setUploading(false);
    setError("");
    setLink("");
    changed();
  }
  return (
    <section className="ad-image-editor" aria-labelledby={`${id}-heading`}>
      <div className="composer-section-heading">
        <h3 id={`${id}-heading`}>Advertisement image</h3>
        <span>Required ratio {ratioLabel}</span>
      </div>
      <input
        ref={input}
        className="visually-hidden-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={disabled || uploading}
        aria-label="Choose advertisement image"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          choose(file);
        }}
      />
      {!source ? (
        <div
          className="image-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            choose(event.dataTransfer.files[0]);
          }}
        >
          <div className="image-drop-copy">
            <strong>
              {loading
                ? "Opening image…"
                : "Choose or drop an advertisement image"}
            </strong>
            <span>PNG, JPG, WebP or GIF · Up to 5 MB</span>
          </div>
          <div className="image-attachment-actions">
            <button
              type="button"
              className="secondary"
              disabled={disabled || loading}
              onClick={() => input.current?.click()}
            >
              Choose image
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="ad-image-summary">
            <img
              src={uploaded || source.url}
              alt="Advertisement image preview"
              style={{ aspectRatio: String(ratio) }}
            />
            <div>
              <strong>{source.filename}</strong>
              <p className="muted">
                {uploaded
                  ? `Uploaded · ${ratioLabel}`
                  : `Crop and upload at ${ratioLabel} before saving.`}
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={disabled}
                  onClick={() => setCropOpen(true)}
                >
                  {uploaded ? "Edit crop" : "Crop image"}
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={disabled}
                  onClick={clear}
                >
                  Remove image
                </button>
              </div>
            </div>
          </div>
          <dialog
            ref={dialog}
            className="ad-crop-dialog"
            aria-labelledby={`${id}-crop-title`}
            aria-describedby={`${id}-crop-description`}
            onCancel={(event) => {
              event.preventDefault();
              closeCrop();
            }}
          >
            <div className="ad-crop-dialog-header">
              <h2 id={`${id}-crop-title`}>Crop advertisement image</h2>
              <button
                type="button"
                className="secondary small"
                autoFocus
                onClick={closeCrop}
              >
                Close
              </button>
            </div>
            <p className="muted" id={`${id}-crop-description`}>
              Original: {source.width} × {source.height}px.{" "}
              {matching
                ? "This image matches the placement. You can upload it or adjust the crop."
                : `This image needs cropping to ${ratioLabel}. Adjust the preview below, then crop and upload.`}
            </p>
            <div
              className="ad-crop-frame"
              style={{ aspectRatio: String(ratio) }}
            >
              <canvas
                ref={canvas}
                width={width}
                height={height}
                aria-label={`Preview of advertisement cropped to ${ratioLabel}`}
                onPointerDown={(event) => {
                  if (disabled || uploading) return;
                  drag.current = { x: event.clientX, y: event.clientY };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={move}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
              />
            </div>
            <p className="muted ad-crop-help">
              Drag the image to reposition it, or use the controls below.
              Uploads use the crop shown in the preview.
            </p>
            <fieldset
              className="ad-crop-controls"
              disabled={disabled || uploading}
            >
              <label>
                Zoom
                <input
                  type="range"
                  min="1"
                  max="4"
                  step=".01"
                  value={zoom}
                  onChange={(event) => {
                    setZoom(Number(event.target.value));
                    changed();
                  }}
                />
              </label>
              <label>
                Horizontal position
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".005"
                  value={position.x}
                  onChange={(event) => {
                    setPosition((value) => ({
                      ...value,
                      x: Number(event.target.value),
                    }));
                    changed();
                  }}
                />
              </label>
              <label>
                Vertical position
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".005"
                  value={position.y}
                  onChange={(event) => {
                    setPosition((value) => ({
                      ...value,
                      y: Number(event.target.value),
                    }));
                    changed();
                  }}
                />
              </label>
            </fieldset>
            <div className="form-actions">
              <button
                type="button"
                disabled={disabled || uploading || !!uploaded}
                onClick={() => void upload()}
              >
                {uploading
                  ? "Uploading…"
                  : uploaded
                    ? "Image uploaded"
                    : matching && zoom === 1
                      ? "Upload image"
                      : "Crop & upload"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={disabled || uploading}
                onClick={() => {
                  setZoom(1);
                  setPosition({ x: 0.5, y: 0.5 });
                  changed();
                }}
              >
                Reset crop
              </button>
              <button
                type="button"
                className="text-button"
                disabled={disabled}
                onClick={clear}
              >
                Remove image
              </button>
            </div>
            {error && (
              <p className="attachment-error" role="alert">
                {error}
              </p>
            )}
          </dialog>
        </>
      )}
      {error && !cropOpen && (
        <p className="attachment-error" role="alert">
          {error}
        </p>
      )}
      {!source && (
        <details className="image-url-alternative">
          <summary>Load an image from a URL</summary>
          <div className="image-link-row">
            <label className="sr-only" htmlFor={`${id}-url`}>
              Image URL
            </label>
            <input
              id={`${id}-url`}
              type="url"
              value={link}
              disabled={disabled || loading}
              placeholder="https://…"
              onChange={(event) => setLink(event.target.value)}
            />
            <button
              type="button"
              className="secondary small"
              disabled={disabled || loading || !link.trim()}
              onClick={() => {
                try {
                  const url = new URL(link);
                  if (!["http:", "https:"].includes(url.protocol))
                    throw new Error();
                  void load(url.href, false, "advertisement");
                } catch {
                  setError("Enter a valid HTTP(S) image URL.");
                }
              }}
            >
              Load image
            </button>
          </div>
        </details>
      )}
      <small className="ad-crop-format-note">
        Crops are uploaded as PNG images. Animated images use a single frame.
      </small>
    </section>
  );
}

export function AdvertisementForm({
  onSubmit,
}: {
  onSubmit: (values: Row) => Promise<void>;
}) {
  const [placement, setPlacement] = useState("home_banner");
  const [uploaded, setUploaded] = useState("");
  const [saving, setSaving] = useState(false);
  const ratio = placement === "home_banner" ? 16 / 9 : 6.78;
  const ratioLabel = placement === "home_banner" ? "16:9" : "6.78:1";
  return (
    <Form
      fields={resources.advertisements.fields!.filter(
        (field) => !["adImage", "placement"].includes(field.name),
      )}
      submitLabel="Create advertisement"
      submitDisabled={!uploaded || saving}
      extraContent={
        <div className="field-wide">
          <div className="field">
            <label htmlFor="ad-placement">Placement</label>
            <select
              id="ad-placement"
              value={placement}
              disabled={saving}
              onChange={(event) => {
                const next = event.target.value;
                if (
                  (next === "home_banner") !==
                  (placement === "home_banner")
                ) {
                  setUploaded("");
                }
                setPlacement(next);
              }}
            >
              <option value="home_banner">Home banner — 16:9</option>
              <option value="championship_card">
                Championship card — 6.78:1
              </option>
              <option value="question_view">Question view — 6.78:1</option>
            </select>
          </div>
          <AdvertisementImage
            ratio={ratio}
            ratioLabel={ratioLabel}
            disabled={saving}
            onChange={setUploaded}
          />
        </div>
      }
      onSubmit={async (values) => {
        if (!uploaded)
          throw new Error(
            "Crop and upload an image before creating the advertisement.",
          );
        setSaving(true);
        try {
          await onSubmit({
            ...values,
            adImage: uploaded,
            placement,
            aspectRatio: ratioLabel,
          });
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}
