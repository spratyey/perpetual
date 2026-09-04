# Perpetual

A video editor in the browser that a person and an agent can edit together. Same
project, same timeline, same undo stack. The agent works through
[WebMCP](https://webmachinelearning.github.io/webmcp/) rather than a chat box
bolted onto the side of a normal editor.

- **Try it:** [app.perpetual.video](https://app.perpetual.video)
- **Demo video:** [youtu.be/bzTxLXt0RNo](https://youtu.be/bzTxLXt0RNo)
- **About:** [perpetual.video](https://perpetual.video)

Everything runs in the browser. There is no backend and no account. Projects,
media and history live in IndexedDB, and nothing leaves your machine except what
you explicitly send to Gemini.

## The problem

We built Perpetual because video editing is often the bottleneck for builders,
researchers and creators. Existing AI editors usually hide the timeline behind a
prompt, or put a chat box beside a normal editor. Neither one lets a person and
an agent really tag team inside the same project.

So both edit through the same harness. A person edits through the interface. An
agent edits through 34 WebMCP tools. Every change is attributed, visible and
reversible, and there is one shared history. Undo does not care who made the
edit.

## What the agent can do

It can inspect a project, import media by URL, index footage with Gemini, search
speech and shots, cut frame accurately, arrange clips, edit overlays, generate
images and video, and add kinetic captions that pass behind the subject.

Tool availability follows the project lifecycle. The editing tools only exist
while a project is open, so an agent cannot add text to nothing. Every call is
validated against a strict schema, recorded to a durable log, and reported on
screen. Anything that costs money or leaves the browser asks for confirmation
first.

## What was hard

Video editing is stateful, but tool calls are independent, so a sequence of
individually valid edits can still produce the wrong result.

What makes it hold together is shared project state, an attributed action
history, and atomic commands for things like timeline arrangement. Alongside
that: local media persistence, blob relinking after a reload, and segment ids
that tie media understanding back to real time ranges.

## What we learned

The action history turned out to be useful well beyond undo. A finished session
can be distilled into a **workflow**: its intent, method, conventions and
adaptation rules, written as prose rather than a fixed timeline. An agent asked
to work "like that other project" reads the approach and re derives it against
whatever footage is in front of it.

The same harness could set up projects, run agents in parallel, and record
outcomes for evaluation or training. Video is our first environment. Motion
graphics and canvas design fit the same shape.

## Layout

Three independent projects. Each one deploys separately from the CLI.

| Folder | What it is | Deploys to |
| --- | --- | --- |
| `app/` | The editor. React, Vite, Remotion, and the 34 WebMCP tools. | `app.perpetual.video` (Cloudflare Pages) |
| `landing/` | The public page. Next.js 16 and OpenNext. | `perpetual.video` (Cloudflare Worker) |
| `proxy/` | Optional. Lends a rate limited Gemini key to visitors who have none. | Cloudflare Worker |

## Running it

You need Node 22+ and pnpm 10+. Both apps default to port 3000, so run one at a
time.

```bash
cd app && pnpm install && pnpm dev          # the editor
cd landing && pnpm install && pnpm dev      # the public page
```

The editor needs no key and no config to be useful. Import media, cut, arrange,
add text and shapes, undo, and drive all of it from an agent. A Gemini key is
only needed for the four features that call Google: generation, media
understanding, kinetic captions, and capturing a workflow.

There are two ways to supply one.

1. **Paste it into the app.** Click the key icon in the header. It is held in
   memory for that tab only, and never written to disk, a URL, or a tool result.
2. **Point at a proxy.** Copy `app/.env.example` to `app/.env.development` and
   set `VITE_PROXY_URL` to your deployed proxy. The app then borrows a shared
   key and the header icon becomes optional. This is how the hosted demo works.

Leave `VITE_PROXY_URL` unset and you get a bring your own key build. Both are
fine, but a deployment that means to be try it now and forgets the variable
fails in one confusing way, so set it on purpose rather than by accident.

### The proxy

Only needed if you want the shared key behaviour. It holds the key server side
so it never reaches the browser. Putting a key in a client bundle publishes it,
because public bundles are readable by anyone and get scraped.

```bash
cd proxy && pnpm install
npx wrangler kv namespace create BUDGET   # put the id in wrangler.toml
npx wrangler secret put GEMINI_API_KEY
pnpm dev
```

There are four limits, and none of them is enough on its own, which is why there
are four. An origin allowlist, which a script can forge but which is cheap to
keep. A path and model allowlist, which is the real protection: only the models
the editor uses are reachable, and only one method on each, so this is not a
free general purpose Gemini. A daily budget counted in cents. And a per IP
hourly cap. `DAILY_BUDGET_CENTS` in `proxy/index.ts` is the number to change.

## Deploying

By CLI, one folder at a time. Set `CLOUDFLARE_ACCOUNT_ID` if your token can see
more than one account.

```bash
cd app && pnpm build && npx wrangler pages deploy dist --project-name=perpetual-editor --branch=main
cd landing && npx opennextjs-cloudflare build && npx wrangler deploy
cd proxy && npx wrangler deploy
```

`app/.env.production` is not committed, so a build from a fresh clone is bring
your own key. Copy it from `.env.example` and fill in your proxy URL if you want
the shared key build.

## Worth knowing

- **Desktop only.** The editor assumes a mouse and a wide viewport.
- **Storage can be refused.** Sandboxed and partitioned contexts, including some
  agent browsers, either deny IndexedDB or hang when opening it. Both cases are
  detected. The session falls back to memory and says plainly that nothing is
  being saved.
- **WebMCP needs enabling.** In Chrome, go to `chrome://flags` and turn on
  **WebMCP**. Without it the editor works normally and only the agent tools are
  missing. The console tells you which mode you are in.
- **Captions need the network.** Subject masking fetches MediaPipe from a CDN
  and runs on your GPU. The video never leaves the browser for that step, but
  the step does need a connection.
- **Gemini limits shape the design.** Structured output caps out at nesting
  depth 5 and 100 properties. The File API allows 2 GB per file and 20 GB per
  project, and deletes uploads after 48 hours. We delete indexed media straight
  after use rather than leaving it to expire.

## Built with

Chrome and WebMCP, React, Vite, Remotion, Next.js 16, Tailwind, shadcn/ui,
Radix, Zod, IndexedDB, MediaPipe, Gemini and Veo, Cloudflare Workers and Pages,
TypeScript, pnpm.

## License

[MIT](LICENSE)
