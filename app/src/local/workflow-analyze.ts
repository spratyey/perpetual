/**
 * Turning a distilled log into a workflow.
 *
 * This is the one place the page calls a model. The distillation says *what
 * happened*; the model's job is the part only judgment can do — why the person was
 * doing it, how they went about it, which choices are conventions worth keeping
 * and which are incidental to that project's content.
 *
 * The output is written for an agent to read later, when it is asked to "do
 * what was done in that project" against a project whose state is different.
 * So the prompt pushes for roles and relationships rather than literals, and
 * for explicit guidance on what to hold fixed versus re-derive.
 */

import { analyseJson } from "./gemini";
import { distill } from "./workflow-distill";
import type { AspectRatio, LoggedEvent, Workflow } from "./types";

const SYSTEM = `You analyse video-editing sessions and encapsulate them as reusable workflows.

You are given a faithful, normalised record of what someone did in one project: an ordered
list of actions, with geometry already expressed as fractions of the canvas and timing in
seconds. Element references point at the action that created the element, not at ids.

Your job is NOT to restate the actions. It is to work out what the person was doing and
why, so that a different agent — later, in a different project with different footage,
possibly a different aspect ratio and a different number of clips — can achieve the same
kind of result without copying anything literally.

Write for that reader. Concretely:

- intent: what outcome they were going for. Infer it from the shape of the edit, the text
  they wrote, the rhythm of the timing. Say what you are inferring rather than asserting
  certainty you do not have.
- method: how they went about it, as an approach. "Built each section by laying a
  background bar first, then the title over it" — not "called add_shape then add_text".
- pattern: the ordered beats of the edit, in terms of roles. If something repeats per clip
  or per section, say so explicitly, because the next project will have a different count.
- conventions: the choices that look deliberate and reusable — placement habits, a colour
  used throughout, a consistent duration, safe margins. Give fractions or seconds, since
  pixels will not transfer.
- adaptation: what to hold fixed and what to re-derive from the new project. Be direct
  about what would break if copied literally.

Be concrete and brief. Do not invent detail the record does not support; if the session is
too short or too incoherent to read an intent from, say that plainly in intent and keep the
rest minimal.`;

const SCHEMA = {
  type: "object",
  required: ["name", "summary", "intent", "method", "pattern", "conventions", "adaptation"],
  properties: {
    name: { type: "string", description: "Short, specific, human name. 2-5 words." },
    summary: { type: "string", description: "One line an agent can scan in a list." },
    intent: { type: "string", description: "Why: the outcome they were going for." },
    method: { type: "string", description: "How: the approach, in prose." },
    pattern: {
      type: "array",
      items: { type: "string" },
      description: "Ordered beats in terms of roles, noting anything that repeats per clip or section.",
    },
    conventions: {
      type: "array",
      items: { type: "string" },
      description: "Reusable choices: placement, colour, duration, margins. Use fractions or seconds.",
    },
    adaptation: { type: "string", description: "What to hold fixed and what to re-derive." },
  },
} as const;

interface Analysis {
  name: string;
  summary: string;
  intent: string;
  method: string;
  pattern: string[];
  conventions: string[];
  adaptation: string;
}

export interface AnalyseArgs {
  events: LoggedEvent[];
  logWasTrimmed: boolean;
  projectId: string;
  projectName: string;
  aspectRatio: AspectRatio;
  assetKindById?: Record<string, string>;
  signal?: AbortSignal;
}

export interface AnalyseResult {
  workflow: Workflow;
  /** What distillation discarded, surfaced to the caller. */
  notes: string[];
}

export async function analyseIntoWorkflow(args: AnalyseArgs): Promise<AnalyseResult> {
  const d = distill(args.events, {
    aspectRatio: args.aspectRatio,
    assetKindById: args.assetKindById,
  });

  if (d.actionCount === 0) {
    throw new Error("Nothing in that project's log describes an edit, so there is no pattern to capture.");
  }

  const notes = [...d.notes];
  if (args.logWasTrimmed) {
    notes.push("The log had been trimmed, so the earliest actions are missing from this analysis.");
  }

  const prompt = [
    `Project: ${args.projectName}`,
    `Canvas: ${args.aspectRatio}`,
    `Timeline length: ${d.timelineSeconds}s`,
    `Element kinds used: ${d.elementKinds.join(", ") || "none"}`,
    `Colours used: ${d.colours.join(", ") || "none"}`,
    notes.length ? `Caveats about this record: ${notes.join(" ")}` : "",
    "",
    "Actions, in order. Geometry is a fraction of the canvas (x,y = top-left, w,h = size).",
    '"targets" refers to the element created by that earlier action number.',
    "",
    JSON.stringify(d.actions, null, 1),
  ]
    .filter(Boolean)
    .join("\n");

  const analysis = await analyseJson<Analysis>({
    system: SYSTEM,
    prompt,
    schema: SCHEMA,
    signal: args.signal,
  });

  const now = Date.now();
  const workflow: Workflow = {
    version: 2,
    id: crypto.randomUUID(),
    name: analysis.name?.trim() || `Workflow from ${args.projectName}`,
    createdAt: now,
    updatedAt: now,
    sourceProjectId: args.projectId,
    sourceProjectName: args.projectName,
    summary: analysis.summary,
    intent: analysis.intent,
    method: analysis.method,
    pattern: analysis.pattern ?? [],
    conventions: analysis.conventions ?? [],
    adaptation: analysis.adaptation,
    observed: {
      actionCount: d.actionCount,
      aspectRatio: args.aspectRatio,
      timelineSeconds: d.timelineSeconds,
      elementKinds: d.elementKinds,
      colours: d.colours,
      actions: d.actions,
      logWasTrimmed: args.logWasTrimmed,
    },
  };

  return { workflow, notes };
}
