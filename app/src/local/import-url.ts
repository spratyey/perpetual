/**
 * Fetching hosted media into the local library.
 *
 * An agent usually has a URL, not a file — a stock clip, something it generated
 * elsewhere, an image from a page it just read. It cannot put a file into your
 * browser, so without this the library is only reachable by hand.
 *
 * The result is handed to the same `importFiles` the file picker uses, so a URL
 * import gets the same type detection, size limit, thumbnail and duration
 * probe. Nothing here knows about assets; it only produces a `File`.
 *
 * The failure modes are the interesting part. A browser cannot read a
 * cross-origin response unless the host allows it, and most of the ways this
 * goes wrong are indistinguishable from the inside: `fetch` rejects with a bare
 * `TypeError` whether the host refused CORS, the name did not resolve, or the
 * context has no egress at all. So the message says what is *likely* and what
 * to do about it, rather than pretending to know.
 */

/** Extensions worth trusting when a server sends no usable Content-Type. */
const BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  mkv: "video/x-matroska", avi: "video/x-msvideo",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", avif: "image/avif", svg: "image/svg+xml", bmp: "image/bmp",
  mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav",
  ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/opus", flac: "audio/flac",
};

export class UrlImportError extends Error {}

/**
 * Only http(s). A `file:`, `data:` or `blob:` URL would either fail or reach
 * for something an agent has no business reaching for.
 */
function parse(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlImportError(`"${raw.slice(0, 120)}" is not a valid URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlImportError(`Only http and https URLs can be imported, not ${url.protocol}`);
  }
  return url;
}

/** A readable filename from the URL, ignoring query strings and directories. */
function nameFrom(url: URL, mimeType: string): string {
  const last = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "");
  if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return last.slice(0, 120);
  const guessed = Object.entries(BY_EXTENSION).find(([, m]) => m === mimeType)?.[0];
  const stem = (last || url.hostname).replace(/[^\w.-]+/g, "-").slice(0, 100);
  return guessed ? `${stem}.${guessed}` : stem;
}

function mimeFor(url: URL, header: string | null): string {
  const declared = (header ?? "").split(";")[0].trim().toLowerCase();

  // Trust the server only when it named a media type. Anything else — an
  // `application/octet-stream`, or a container type like `application/ogg`
  // that is genuinely audio — is better resolved from the extension, which is
  // what the rest of the app understands. Wikimedia serves .ogg exactly this
  // way, so trusting the header would reject a perfectly good audio file.
  if (/^(video|image|audio)\//.test(declared)) return declared;

  const ext = url.pathname.split(".").at(-1)?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? declared;
}

export interface FetchedMedia {
  file: File;
  mimeType: string;
  /** What the server said, when it differed from what we settled on. */
  declaredType: string | null;
  bytes: number;
}

export async function fetchMediaAsFile(raw: string, signal?: AbortSignal): Promise<FetchedMedia> {
  const url = parse(raw);

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal, redirect: "follow", mode: "cors" });
  } catch (err) {
    if (signal?.aborted) throw new UrlImportError("The import was cancelled.");
    throw new UrlImportError(
      `The browser could not fetch ${url.hostname}. The request never completed, which usually means ` +
        "the host does not allow other sites to read its files (no CORS header), the address does not " +
        "resolve, or this browser has no direct network access. A host that serves media to web apps — " +
        "most CDNs and object stores — will work; a page that only serves media to its own site will not."
    );
  }

  if (!response.ok) {
    throw new UrlImportError(
      `${url.hostname} answered HTTP ${response.status} for that file.` +
        (response.status === 403 || response.status === 401
          ? " The link may need a signed or logged-in request, which this cannot do."
          : response.status === 404
            ? " Check the URL."
            : "")
    );
  }

  const declaredType = response.headers.get("content-type");
  const mimeType = mimeFor(url, declaredType);

  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    throw new UrlImportError(
      `That URL returned ${mimeType}, not media. It is probably a web page rather than a direct file — ` +
        "look for the underlying .mp4, .png or .mp3 link."
    );
  }

  const blob = await response.blob();
  if (blob.size === 0) throw new UrlImportError("That URL returned an empty file.");

  // The blob's own type wins if we still have nothing usable.
  const finalType = mimeType || blob.type;
  const file = new File([blob], nameFrom(url, finalType), { type: finalType });
  return { file, mimeType: finalType, declaredType, bytes: blob.size };
}
