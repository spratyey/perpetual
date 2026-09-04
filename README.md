## The problem

We built Perpetual because video editing is often the bottleneck for builders, researchers, and creators. Existing AI editors usually hide the timeline behind a prompt, or place a chat box beside a normal editor. We wanted a person and an agent to seamlessly tag-team inside the same project.

## What we built

Perpetual lays out an ambitious concept for browser-based video editing with a canvas, timeline, media library, project management, and shared history.

- A person edits through the interface.
- An agent edits through **WebMCP**. Both use the same **editing harness**, so every change stays visible, editable, and reversible.

## How we used WebMCP

WebMCP is central to the product architecture. The agent can inspect projects, index local media, search speech and shots, cut frame-accurately, arrange clips, edit overlays, generate media, and add kinetic captions.

Tool availability follows the project lifecycle. Strict schemas, confirmation steps, activity feedback, and shared undo keep agent actions controlled.

## Challenges

Video editing is stateful, while tool calls are independent, and thus a sequence of valid edits can produce the wrong result.

We addressed this with shared project state, attributed action history, and atomic commands for operations like timeline arrangement. We also built local media persistence, Blob relinking after reload, and validated segment IDs that connect media understanding to real time ranges.

## What we learned

The action history is useful beyond undo. Perpetual can distill a completed editing session into a reusable **recipe/workflow**: its intent, method, conventions, and adaptation rules. An agent can apply that approach to new footage without copying a fixed timeline.

## Where this goes

The same harness can init projects, run agents in parallel, and record outcome for evaluation, training or RL. Video is our first environment; motion graphics and canvas-based design can use the same core Perpetual paradigm.

## Built With

- [chrome](https://devpost.com/software/built-with/chrome)
- google-gemini
- [html5](https://devpost.com/software/built-with/html5)
- indexeddb
- [javascript](https://devpost.com/software/built-with/javascript)
- mediapipe
- pnpm
- radix-ui
- [react](https://devpost.com/software/built-with/react)
- remotion
- shadcn-ui
- tailwind
- [typescript](https://devpost.com/software/built-with/typescript)
- veo
- vite
- webmcp
- zod

## Try it out

- [app.perpetual.video](https://app.perpetual.video/)
- [GitHub Repo](https://github.com/spratyey/perpetual)
