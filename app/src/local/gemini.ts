/**
 * Gemini client — bring your own key, or borrow the demo's.
 *
 * A user key lives in this module's memory for the lifetime of the tab. It is
 * never written to IndexedDB, localStorage, the URL, the project file or a tool
 * result, and it goes straight to Google — no server of ours sees it.
 *
 * When no user key is set and a demo proxy is configured, requests go there
 * instead so a visitor can try the thing without signing up for anything. The
 * proxy holds a key server-side under a spend budget; it never reaches the
 * browser. Shipping the key in this bundle would have been the fast version of
 * that and the wrong one — a public bundle is readable by anyone.
 *
 * A user key always wins, so anyone who brings one is never rate limited by
 * other people's usage.
 */

import { useSyncExternalStore } from "react";

import { markSharedKeyExhausted } from "./shared-key";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const PROXY = (import.meta.env.VITE_PROXY_URL as string | undefined)?.replace(/\/$/, "") || null;

/** True when this request will be spent from the shared demo budget. */
export function usingSharedKey(): boolean {
  return apiKey === null && PROXY !== null;
}

/** Whether anything at all can be generated: a user key, or the demo proxy. */
export function canGenerate(): boolean {
  return apiKey !== null || PROXY !== null;
}
const UPLOAD_ENDPOINT = "https://generativelanguage.googleapis.com/upload/v1beta/files";
export const IMAGE_MODEL = "gemini-3.1-flash-lite-image";
export const VIDEO_MODEL = "veo-3.1-lite-generate-preview";
export const ANALYSIS_MODEL = "gemini-3.7-flash";

/** List prices, shown to the user before a paid request leaves the browser. */
export const IMAGE_PRICE_USD = 0.034;
export const VIDEO_PRICE_USD_PER_SECOND = 0.05;

let apiKey: string | null = null;

/**
 * Whether a key is set is React state as far as the UI is concerned.
 *
 * It lives in module memory rather than a component, so a plain `hasApiKey()`
 * read during render never re-runs when the key arrives — which is exactly how
 * the capture button once stayed disabled forever.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function setApiKey(key: string): void {
  apiKey = key.trim() || null;
  notify();
}

export function clearApiKey(): void {
  apiKey = null;
  notify();
}

export function hasApiKey(): boolean {
  return apiKey !== null;
}

/** Reactive form of `canGenerate`, for anything that renders off it. */
export function useCanGenerate(): boolean {
  return useSyncExternalStore(subscribe, canGenerate, canGenerate);
}

export class GeminiError extends Error {}

/**
 * Asks for a JSON object matching a schema, from a prompt alone.
 *
 * The same structured-output mechanism `analyzeMedia` uses, minus the file:
 * the shape is enforced by the API rather than by asking nicely and hoping.
 * Workflow analysis runs through here — it used to be a separate Claude
 * client, which meant a second key, a second provider and a second failure
 * mode for one call.
 */
/**
 * Trims a JSON Schema down to what `responseSchema` accepts.
 *
 * Gemini took `additionalProperties` from November 2025, so that one is no
 * longer fatal — but `$schema` still is not a field it knows, and the caps are
 * real: nesting depth 5, 100 properties total. Both schemas here sit at depth
 * three with about ten properties, so there is headroom; a much richer schema
 * would need `responseJsonSchema` instead.
 */
function forGemini(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(forGemini);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === "additionalProperties" || key === "$schema") continue;
    out[key] = forGemini(value);
  }
  return out;
}

export async function analyseJson<T>(args: {
  system: string;
  prompt: string;
  schema: unknown;
  signal?: AbortSignal;
}): Promise<T> {
  const response = await call(`${ENDPOINT}/models/${ANALYSIS_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: args.system }] },
      contents: [{ role: "user", parts: [{ text: args.prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: forGemini(args.schema),
      },
    }),
    signal: args.signal,
  });

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    // A blocked prompt comes back with no candidate rather than an error.
    const blocked = payload?.promptFeedback?.blockReason;
    throw new GeminiError(
      blocked ? `Gemini declined the request (${blocked}).` : "Gemini returned an empty analysis."
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError("Gemini's analysis was not valid JSON.");
  }
}

/**
 * The one place the key is attached to a request. Errors carry the status and
 * a short body excerpt only, never the request URL, which could echo the key.
 */
async function call(url: string, init: RequestInit = {}): Promise<Response> {
  /*
   * Either the user's key goes to Google directly, or the request goes to the
   * proxy with no key at all. The proxy mirrors Google's path shape, so
   * swapping the origin is the whole difference.
   */
  let target = url;
  let headers = { ...(init.headers as Record<string, string>) };

  if (apiKey) {
    headers["x-goog-api-key"] = apiKey;
  } else if (PROXY) {
    target = url.replace("https://generativelanguage.googleapis.com", PROXY);
  } else {
    throw new GeminiError("Add your Gemini API key before running this tool.");
  }

  let response: Response;
  try {
    response = await fetch(target, { ...init, headers });
  } catch (err) {
    /*
     * `fetch` rejects with a bare `TypeError: Failed to fetch` for every
     * network-layer failure, and that is what an agent was left holding: it
     * could not tell a blocked request from a bad key, quota, or a rejected
     * prompt, so it guessed at all four. None of those produce this — they all
     * produce an HTTP status, handled below. Reaching here means the request
     * never left, which in practice means the browsing context has no direct
     * egress. Sandboxed agent browsers are the common case.
     */
    if ((init as { signal?: AbortSignal }).signal?.aborted) {
      throw new GeminiError("The request was cancelled.");
    }
    throw new GeminiError(
      "The browser could not reach Google's API at all — the request never left. This is not a key, " +
        "quota or prompt problem: those come back with an error from Google. It usually means the " +
        "browser is sandboxed and blocks requests to other sites. Try the same action in a normal " +
        "browser window. " +
        (err instanceof Error ? `(${err.message})` : "")
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const detail = text.slice(0, 160);

    // A 429 from the proxy means the shared budget is gone, not that the user
    // did anything wrong. Surfacing it brings the key dialog back.
    if (response.status === 429 && !apiKey) markSharedKeyExhausted();
    // Say what the status means, so a caller knows whether to retry, ask for a
    // different key, or give up.
    const hint =
      response.status === 400 ? " The request or the prompt was rejected."
      : response.status === 401 || response.status === 403 ? " The API key was refused, or it is not allowed to use this model."
      : response.status === 404 ? " That model is not available to this key."
      : response.status === 429 ? " The key is out of quota or being rate limited. Wait and retry."
      : response.status >= 500 ? " Google had a server error. Retrying may work."
      : "";
    throw new GeminiError(`Gemini refused the request (HTTP ${response.status}).${hint} ${detail}`);
  }
  return response;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export interface GeneratedImage {
  blob: Blob;
  mimeType: string;
}

export async function generateImage(
  prompt: string,
  aspectRatio: string,
  signal?: AbortSignal
): Promise<GeneratedImage> {
  const response = await call(`${ENDPOINT}/models/${IMAGE_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `Generate an image with ${aspectRatio} aspect ratio: ${prompt}` }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
    signal,
  });

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part?.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || "image/png";
      return { blob: base64ToBlob(part.inlineData.data, mimeType), mimeType };
    }
  }
  throw new GeminiError("Gemini returned no image for that prompt.");
}

export type VideoAspectRatio = "16:9" | "9:16";
export type VideoDuration = 4 | 6 | 8;

const VIDEO_POLL_MS = 5000;
const VIDEO_POLL_LIMIT = 90;

/** Veo nests the finished file differently between revisions, so the uri is searched for. */
function findFileUri(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFileUri(item);
      if (found) return found;
    }
    return undefined;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (key === "uri" && typeof nested === "string" && nested.startsWith("http")) return nested;
      const found = findFileUri(nested);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Video is a long-running job: one request starts it, and the operation is
 * polled until a file appears. `onWait` reports the seconds elapsed, because
 * the wait runs into minutes and silence reads as a hang.
 */
export async function generateVideo(
  prompt: string,
  options: { aspectRatio: VideoAspectRatio; durationSeconds: VideoDuration },
  onWait?: (seconds: number) => void,
  signal?: AbortSignal
): Promise<{ blob: Blob; mimeType: string }> {
  const started = await call(`${ENDPOINT}/models/${VIDEO_MODEL}:predictLongRunning`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        aspectRatio: options.aspectRatio,
        durationSeconds: options.durationSeconds,
        resolution: "720p",
      },
    }),
    signal,
  });

  const name = (await started.json())?.name;
  if (!name) throw new GeminiError("Gemini did not start the video job.");

  const begunAt = Date.now();
  for (let attempt = 0; attempt < VIDEO_POLL_LIMIT; attempt++) {
    await wait(VIDEO_POLL_MS, signal);
    onWait?.(Math.round((Date.now() - begunAt) / 1000));

    const operation = await (await call(`${ENDPOINT}/${name}`, { signal })).json();
    if (operation?.error) throw new GeminiError(operation.error.message || "The video could not be generated.");
    if (!operation?.done) continue;

    const uri = findFileUri(operation.response);
    if (!uri) throw new GeminiError("Gemini finished the job but returned no video.");
    const file = await call(uri.includes("alt=media") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}alt=media`, { signal });
    const blob = await file.blob();
    return { blob, mimeType: blob.type || "video/mp4" };
  }
  throw new GeminiError("Gemini took too long to make the video.");
}

interface RemoteFile {
  name: string;
  uri: string;
}
/**
 * Raw upload rather than the resumable protocol: the file arrives in one
 * request and the reply is JSON, so no response header has to be readable
 * from the page.
 */
async function uploadFile(blob: Blob, mimeType: string, signal?: AbortSignal): Promise<RemoteFile> {
  const response = await call(UPLOAD_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": mimeType, "X-Goog-Upload-Protocol": "raw" },
    body: blob,
    signal,
  });
  const file = (await response.json())?.file;
  if (!file?.name || !file?.uri) throw new GeminiError("Gemini accepted the upload but returned no file.");
  return { name: file.name, uri: file.uri };
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Video and audio are transcoded before they can be used in a prompt. */
async function waitUntilActive(name: string, signal?: AbortSignal): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const state = (await (await call(`${ENDPOINT}/${name}`, { signal })).json())?.state;
    if (state === "ACTIVE") return;
    if (state === "FAILED") throw new GeminiError("Gemini could not process that file.");
    await wait(2000, signal);
  }
  throw new GeminiError("Gemini took too long to process that file.");
}

async function deleteFile(name: string): Promise<void> {
  await call(`${ENDPOINT}/${name}`, { method: "DELETE" }).catch(() => undefined);
}

/**
 * Uploads one asset, asks for an index of it, then removes it from Google
 * again. The uploaded copy is never kept, and its identifier never leaves
 * this function.
 */
export async function analyzeMedia(
  blob: Blob,
  mimeType: string,
  prompt: string,
  responseSchema: unknown,
  signal?: AbortSignal
): Promise<unknown> {
  const file = await uploadFile(blob, mimeType, signal);
  try {
    await waitUntilActive(file.name, signal);
    const response = await call(`${ENDPOINT}/models/${ANALYSIS_MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ fileData: { fileUri: file.uri, mimeType } }, { text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema },
      }),
      signal,
    });

    const text = (await response.json())?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new GeminiError("Gemini returned no analysis for that file.");
    try {
      return JSON.parse(text);
    } catch {
      throw new GeminiError("Gemini returned an analysis that could not be read.");
    }
  } finally {
    await deleteFile(file.name);
  }
}
