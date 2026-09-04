# Perpetual

A browser-based video editor that a person and an agent edit **together** — same
project, same timeline, same undo stack. The agent works through
[WebMCP](https://webmachinelearning.github.io/webmcp/) rather than a chat box
bolted to the side of a normal editor.

- **Try it:** [app.perpetual.video](https://app.perpetual.video)
- **Demo video:** [youtu.be/bzTxLXt0RNo](https://youtu.be/bzTxLXt0RNo)
- **About:** [perpetual.video](https://perpetual.video)

Everything runs in the browser. There is no backend and no account: projects,
media and history live in IndexedDB, and nothing leaves the machine except what
you explicitly send to Gemini.

## Why

Video editing is usually the bottleneck for builders, researchers and creators,
and the existing AI editors take one of two shapes: they hide the timeline
behind a prompt, or they put a chat panel next to an ordinary editor. Neither
lets a person and an agent genuinely tag-team inside one project.

So both edit through the same harness. A person edits through the interface; an
agent edits through 34 WebMCP tools; every change is attributed, visible,
reversible and shares one history. Undo does not care who made the edit.

## How the agent edits

The agent can inspect a project, import media by URL, index local footage with
Gemini, search speech and shots, cut frame-accurately, arrange clips, edit
overlays, generate images and video, and add kinetic captions masked behind the
subject.

Tool availability follows the project lifecycle — the editing tools only exist
while a project is open, so an agent cannot add text to nothing. Every tool
call is validated against a strict schema, recorded to a durable log, and
reported on screen; anything that costs money or leaves the browser asks for
confirmation first.

The hard part is that editing is stateful while tool calls are independent, so
a sequence of individually valid edits can still produce the wrong result. What
makes it hold together is shared project state, an attributed action history,
and atomic commands for operations like timeline arrangement — plus local media
persistence, blob relinking after reload, and segment ids that tie media
understanding back to real time ranges.

That history turns out to be useful well beyond undo. A finished session can be
distilled into a **workflow**: its intent, method, conventions and adaptation
rules, captured as prose rather than as a fixed timeline. An agent told to work
"like that other project" reads the approach and re-derives it against the
footage in front of it. The same harness could init projects, run agents in
parallel, and record outcomes for evaluation or training. Video is the first
environment; motion graphics and canvas design fit the same shape.

## Layout

Three independent projects, each deployed separately from the CLI.

| Folder | What it is | Deploys to |
| --- | --- | --- |
| `app/` | The editor — React, Vite, Remotion. The 34 WebMCP tools. | `app.perpetual.video` (Cloudflare Pages) |
| `landing/` | The public page — Next.js 16, OpenNext. | `perpetual.video` (Cloudflare Worker) |
| `proxy/` | Optional. Lends a rate-limited Gemini key to visitors who have none. | Cloudflare Worker |

## Running it

Node 22+ and pnpm 10+. Both apps default to port 3000, so run one at a time.

```bash
cd app && pnpm install && pnpm dev          # the editor
cd landing && pnpm install && pnpm dev      # the public page
```

The editor needs no key and no configuration to be useful: import media, cut,
arrange, add text and shapes, undo, and drive all of it from an agent. A Gemini
key is needed only for the four features that call Google — generation, media
understanding, kinetic captions, and capturing a workflow.

Supply one either by pasting it into the header, where it is held in memory for
that tab alone and never written to disk, a URL or a tool result — or by copying
`app/.env.example` to `app/.env.development` and setting `VITE_PROXY_URL`, which
points the app at the proxy and hides the key control entirely. That second one
is how the hosted demo works.

Leave `VITE_PROXY_URL` unset and you get a pure bring-your-own-key build. Both
are valid, but a deployment that means to be try-it-now and forgets the variable
fails in one specific confusing way — an unexpected "Add Gemini key" button — so
set it deliberately rather than by accident.

### The proxy

Only needed for the shared-key behaviour. It holds the key server-side so it
never reaches the browser; putting a key in a client bundle publishes it, since
public bundles are readable by anyone and are actively scraped.

```bash
cd proxy && pnpm install
npx wrangler kv namespace create BUDGET   # put the id in wrangler.toml
npx wrangler secret put GEMINI_API_KEY
pnpm dev
```

Four limits, none sufficient alone, which is why there are four: an origin
allowlist (forgeable, cheap, kept), a path and model allowlist — the real
protection, since only the models the editor uses are reachable and only the one
method on each, so this is not a free general-purpose Gemini — a daily budget
counted in cents, and a per-IP hourly cap. `DAILY_BUDGET_CENTS` in
`proxy/index.ts` is the number to change.

## Deploying

By CLI, per folder. Set `CLOUDFLARE_ACCOUNT_ID` if your token can see more than
one account.

```bash
cd app && pnpm build && npx wrangler pages deploy dist --project-name=perpetual-editor --branch=main
cd landing && npx opennextjs-cloudflare build && npx wrangler deploy
cd proxy && npx wrangler deploy
```

`app/.env.production` is not committed, so a build from a fresh clone is
bring-your-own-key. Create it from `.env.example` for the shared-key build.

## Worth knowing

- **Desktop only.** The editor assumes a mouse and a wide viewport.
- **Storage can be refused.** Sandboxed and partitioned contexts — some agent
  browsers among them — deny IndexedDB or hang on opening it. Both are
  detected; the session falls back to memory and says plainly that nothing is
  being saved.
- **WebMCP needs enabling.** In Chrome, `chrome://flags` → **WebMCP**. Without
  it the editor works normally and only the agent tools are missing; the
  console says which mode you are in.
- **Captions need the network.** Subject masking fetches MediaPipe from a CDN
  and runs on the local GPU. The video never leaves the browser for that step,
  but the step does need a connection.
- **Gemini limits shape the design.** Structured output caps at nesting depth 5
  and 100 properties; the File API allows 2 GB per file and 20 GB per project,
  and deletes uploads after 48 hours. Indexed media is deleted immediately
  after use rather than left to expire.

## Built with

Chrome and WebMCP · React · Vite · Remotion · Next.js 16 · Tailwind ·
shadcn/ui · Radix · Zod · IndexedDB · MediaPipe · Gemini and Veo · Cloudflare
Workers and Pages · TypeScript · pnpm

## License

[MIT](LICENSE)
