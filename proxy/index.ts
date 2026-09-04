/**
 * Demo key proxy.
 *
 * The editor is bring-your-own-key by design: a key stays in the tab and never
 * reaches a server, which is the whole privacy story. But a viewer of a demo
 * has no key and should not need one, so this holds a demo key server-side and
 * lends it out under strict limits.
 *
 * Putting the key in the client bundle instead would publish it. A public
 * bundle is readable by anyone and is actively scraped, so that key would be
 * spending someone else's money within days. The proxy keeps it secret; what it
 * has to defend against is being used as a free, general-purpose LLM.
 *
 * One provider: Gemini. Workflow analysis used to go to Claude, which meant a
 * second secret here and a second way for one feature to break; it is a
 * structured-JSON call that Gemini does natively, so it moved.
 *
 * Four defences, none sufficient alone:
 *
 *  1. **Origin allowlist.** Trivially forgeable by a script, so it only stops
 *     other *sites* embedding this, not a determined caller. Cheap, so kept.
 *  2. **Path and model allowlist.** The real protection. Only the handful of
 *     operations the editor performs, on the exact models it uses. An open
 *     `generateContent` relay would be a free Gemini; this is not one.
 *  3. **A daily spend budget**, counted in cents across all callers. When it is
 *     gone the proxy stops, and viewers are told to add their own key. This is
 *     what bounds the loss to a number chosen in advance.
 *  4. **Per-IP hourly cap**, so one caller cannot drain the day's budget alone.
 *
 * Anything a viewer types still reaches Google. Nothing is logged here.
 */

interface Env {
  BUDGET: KVNamespace;
  ALLOWED_ORIGINS: string;
  GEMINI_API_KEY: string;
}

const GEMINI = "https://generativelanguage.googleapis.com";

/** Uploads are the media itself, so they need their own ceiling. */
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/** Only these models, and only these methods on them. */
const GEMINI_ALLOWED: Record<string, string[]> = {
  "gemini-3.1-flash-lite-image": ["generateContent"],
  "veo-3.1-lite-generate-preview": ["predictLongRunning"],
  "gemini-3.7-flash": ["generateContent"],
};

/** Rough list prices, in cents, so the budget means something. */
const COST_CENTS: Record<string, number> = {
  "gemini-3.1-flash-lite-image": 4,
  "veo-3.1-lite-generate-preview": 40,
  "gemini-3.7-flash": 1,
};

const DAILY_BUDGET_CENTS = 1500; // $15/day for the demo.
const PER_IP_HOURLY_CENTS = 150; // $1.50/hour for one caller.

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisHour(): string {
  return new Date().toISOString().slice(0, 13);
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  const ok = origin && allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin! : allowed[0],
    "Access-Control-Allow-Headers": "content-type,x-goog-api-key,x-goog-upload-protocol",
    "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function refuse(message: string, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { ...headers, "content-type": "application/json" },
  });
}

/**
 * Counts spend before the request, not after. Over-counting a failed call is
 * the safe direction; under-counting is how a budget gets blown past.
 */
async function chargeOrRefuse(env: Env, ip: string, model: string): Promise<string | null> {
  const cost = COST_CENTS[model] ?? 5;
  const dayKey = `day:${today()}`;
  const ipKey = `ip:${ip}:${thisHour()}`;

  const [daySoFar, ipSoFar] = await Promise.all([
    env.BUDGET.get(dayKey).then((v) => Number(v ?? 0)),
    env.BUDGET.get(ipKey).then((v) => Number(v ?? 0)),
  ]);

  if (daySoFar + cost > DAILY_BUDGET_CENTS) {
    return "The shared demo budget for today is used up. Add your own API key in the editor header to keep going — it stays in your browser.";
  }
  if (ipSoFar + cost > PER_IP_HOURLY_CENTS) {
    return "You have used this hour's share of the shared demo key. Add your own API key in the editor header to continue without waiting.";
  }

  await Promise.all([
    env.BUDGET.put(dayKey, String(daySoFar + cost), { expirationTtl: 172800 }),
    env.BUDGET.put(ipKey, String(ipSoFar + cost), { expirationTtl: 7200 }),
  ]);
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
    if (!origin || !allowed.includes(origin)) {
      return refuse("This proxy only serves the Perpetual editor.", 403, cors);
    }

    const url = new URL(request.url);
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";

    // ── Gemini ──
    // Mirrors Google's own path shape so the client needs no special casing.
    const gemini = url.pathname.match(/^\/v1beta\/models\/([^:]+):(\w+)$/);
    if (gemini) {
      const [, model, method] = gemini;
      if (!GEMINI_ALLOWED[model]?.includes(method)) {
        return refuse(`This demo proxy does not allow ${method} on ${model}.`, 403, cors);
      }
      const denied = await chargeOrRefuse(env, ip, model);
      if (denied) return refuse(denied, 429, cors);

      const upstream = await fetch(`${GEMINI}/v1beta/models/${model}:${method}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: request.body,
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { ...cors, "content-type": upstream.headers.get("content-type") ?? "application/json" },
      });
    }

    // Polling a long-running video job, and fetching the file it produced.
    // Read-only and already bounded by the job that created it, so no charge.
    const operation = url.pathname.match(/^\/v1beta\/(models\/[^/]+\/operations\/[\w-]+)$/);
    if (operation && request.method === "GET") {
      const upstream = await fetch(`${GEMINI}/v1beta/${operation[1]}`, {
        headers: { "x-goog-api-key": env.GEMINI_API_KEY },
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { ...cors, "content-type": upstream.headers.get("content-type") ?? "application/json" },
      });
    }

    const download = url.pathname.match(/^\/v1beta\/(files\/[\w-]+):download$/);
    if (download) {
      const upstream = await fetch(`${GEMINI}/v1beta/${download[1]}:download?alt=media`, {
        headers: { "x-goog-api-key": env.GEMINI_API_KEY },
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { ...cors, "content-type": upstream.headers.get("content-type") ?? "application/octet-stream" },
      });
    }

    /*
     * ── The File API ──
     *
     * Indexing a video is a four-step conversation, and the proxy allowed only
     * one of them, so video understanding failed outright on the shared key
     * with "Not a route this proxy serves": upload the media, poll until Google
     * has transcoded it, prompt against it, then delete it. All four are
     * needed, and the delete most of all — without it every indexed video would
     * be left sitting in the demo account.
     *
     * Charged as one analysis at upload, since that is what the sequence costs.
     */
    if (url.pathname === "/upload/v1beta/files" && request.method === "POST") {
      const declared = Number(request.headers.get("content-length") ?? 0);
      if (declared > MAX_UPLOAD_BYTES) {
        return refuse(
          `That file is larger than the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB the demo key accepts.`,
          413,
          cors
        );
      }
      const denied = await chargeOrRefuse(env, ip, "gemini-3.7-flash");
      if (denied) return refuse(denied, 429, cors);

      const upstream = await fetch(`${GEMINI}/upload/v1beta/files`, {
        method: "POST",
        headers: {
          "x-goog-api-key": env.GEMINI_API_KEY,
          "content-type": request.headers.get("content-type") ?? "application/octet-stream",
          "x-goog-upload-protocol": request.headers.get("x-goog-upload-protocol") ?? "raw",
        },
        body: request.body,
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { ...cors, "content-type": upstream.headers.get("content-type") ?? "application/json" },
      });
    }

    // Polling transcode state, and deleting the copy afterwards. Both are
    // scoped to one file id and neither is charged.
    const file = url.pathname.match(/^\/v1beta\/(files\/[\w-]+)$/);
    if (file && (request.method === "GET" || request.method === "DELETE")) {
      const upstream = await fetch(`${GEMINI}/v1beta/${file[1]}`, {
        method: request.method,
        headers: { "x-goog-api-key": env.GEMINI_API_KEY },
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { ...cors, "content-type": upstream.headers.get("content-type") ?? "application/json" },
      });
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    return refuse("Not a route this proxy serves.", 404, cors);
  },
};
