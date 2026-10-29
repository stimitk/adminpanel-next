import { demoEnabled } from "./demo-config";
import type { Envelope, Session } from "./types";

const base = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001/api/v1"
).replace(/\/$/, "");
let session: Session | null = null;
let refreshing: Promise<string> | null = null;
let generation = 0;
export function setSession(value: Session | null) {
  session = value;
  generation += 1;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
function messageOf(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const data = body as Record<string, unknown>;
  if (Array.isArray(data.error)) {
    const details = data.error
      .map(
        (e: { path?: string[]; message?: string }) =>
          `${e.path?.join(".") || "Request"}: ${e.message || "Invalid value"}`,
      )
      .join("; ");
    if (details) return details;
  }
  return typeof data.message === "string" ? data.message : fallback;
}
async function refresh(): Promise<string> {
  if (!session?.refreshToken)
    throw new ApiError("Your session expired. Please sign in again.", 401);
  if (!refreshing) {
    const version = generation;
    const token = session.refreshToken;
    refreshing = (async () => {
      const response = await fetch(`${base}/auth/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: token }),
        cache: "no-store",
      });
      const body = (await response.json()) as Envelope<{ accessToken: string }>;
      if (!response.ok || !body.success || !body.data?.accessToken)
        throw new ApiError("Your session expired. Please sign in again.", 401);
      if (!session || version !== generation)
        throw new ApiError("Please sign in again.", 401);
      session.accessToken = body.data.accessToken;
      return body.data.accessToken;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}
export async function api<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    public?: boolean;
  } = {},
  retry = true,
): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("Invalid API path");
  if (demoEnabled) {
    const { demoRequest } = await import("./demo");
    const result = demoRequest(
      path,
      options.method || "GET",
      options.body,
      session,
    );
    if (result.handled) return result.data as T;
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  const multipart =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body !== undefined && !multipart)
    headers["Content-Type"] = "application/json";
  if (!options.public && session?.accessToken)
    headers.Authorization = `Bearer ${session.accessToken}`;
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method || "GET",
      headers,
      body:
        options.body === undefined
          ? undefined
          : multipart
            ? (options.body as FormData)
            : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      "Cannot reach the service. Check your connection and try again.",
      0,
    );
  }
  if (
    response.status === 401 &&
    retry &&
    !options.public &&
    session?.refreshToken
  ) {
    try {
      await refresh();
    } catch {
      setSession(null);
      window.dispatchEvent(new Event("kgamify:expired"));
      throw new ApiError("Your session expired. Please sign in again.", 401);
    }
    return api<T>(path, options, false);
  }
  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || body?.success === false)
    throw new ApiError(
      messageOf(body, `Request failed (${response.status}). Please try again.`),
      response.status,
    );
  if (!body || !("data" in body))
    throw new ApiError(
      "The service returned an unexpected response.",
      response.status,
    );
  return body.data;
}
export function asId(value: string): string | number {
  // The documented backend uses integers. Preserve UUID strings for a future API migration.
  return /^\d+$/.test(value) ? Number(value) : value;
}
export function rowsOf(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    for (const key of [
      "questions",
      "items",
      "results",
      "participants",
      "data",
    ]) {
      const rows = (value as Record<string, unknown>)[key];
      if (Array.isArray(rows)) return rows;
    }
  }
  return [];
}
export function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export async function uploadQuestionImage(
  file: File,
  signal?: AbortSignal,
): Promise<string> {
  return uploadImage(file, "/questions/images", signal);
}
export async function uploadAdvertisementImage(
  file: File,
  signal?: AbortSignal,
): Promise<string> {
  return uploadImage(file, "/admin/advertisements/images", signal);
}
async function uploadImage(
  file: File,
  endpoint: string,
  signal?: AbortSignal,
): Promise<string> {
  if (demoEnabled && session?.accessToken.startsWith("demo-access-")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const abort = () => {
        reader.abort();
        reject(new DOMException("Upload cancelled", "AbortError"));
      };
      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener("abort", abort, { once: true });
      reader.onload = () => {
        signal?.removeEventListener("abort", abort);
        resolve(String(reader.result));
      };
      reader.onerror = () => {
        signal?.removeEventListener("abort", abort);
        reject(new Error("Cannot read this image. Choose another file."));
      };
      reader.readAsDataURL(file);
    });
  }
  const body = new FormData();
  body.append("file", file);
  const result = await api<{ url: string }>(endpoint, {
    method: "POST",
    body,
    signal,
  });
  if (typeof result.url !== "string" || !result.url)
    throw new Error("The upload service did not return an image URL.");
  const url = new URL(result.url, base);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("The upload service returned an invalid image URL.");
  return url.href;
}
