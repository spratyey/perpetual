/**
 * WebMCP workflow tools.
 *
 * Workflows are for the agent. A workflow is not a script and there is
 * deliberately no replay tool: it encapsulates what a person did, why, and how,
 * so that an agent told "do what was done in that project" can read the pattern
 * and apply it to whatever project is open now — different footage, different
 * clip count, possibly a different canvas. Re-deriving is the point; copying
 * would be wrong, because the states differ.
 *
 * MCP's job here is only to access, create and delete. See PLANS/workflows.md.
 */

import { useEffect, useRef } from "react";
import { z } from "zod";

import { defineTool } from "@/local/webmcp-tool";
import { analyseIntoWorkflow } from "@/local/workflow-analyze";
import { canGenerate } from "@/local/gemini";
import { listEvents } from "@/local/persistence";
import { useAssetStore } from "@/local/asset-store";
import type { Workflows } from "@/local/use-workflows";
import type { Projects } from "@/local/use-projects";
import type { Workflow } from "@/local/types";

const emptyInput = z.object({}).strict();

interface Deps {
  workflows: Workflows;
  projects: Projects;
  /** The open project's canvas, needed to normalise geometry. */
  editorState: () => { aspectRatio: string } | null;
}

export function WebMcpWorkflowsBridge({ deps }: { deps: Deps }) {
  const ref = useRef(deps);
  ref.current = deps;
  const assets = useAssetStore();
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  useEffect(() => {
    const modelContext = document.modelContext;
    const registration = new AbortController();

    const brief = (w: Workflow) => ({
      workflowId: w.id,
      name: w.name,
      summary: w.summary,
      sourceProject: w.sourceProjectName,
      capturedAt: new Date(w.createdAt).toISOString(),
      actionCount: w.observed.actionCount,
      recordedAspectRatio: w.observed.aspectRatio,
    });

    const tools: WebMCP.ModelContextTool[] = [
      defineTool({
        name: "list_workflows",
        title: "List workflows",
        description:
          "List the workflows captured in this browser. A workflow describes what someone did in a " +
          "project and why — a reusable approach, not a script. Use it to find a relevant one when the " +
          "user refers to how something was done before, then read it with get_workflow.",
        schema: emptyInput,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => ({
          ok: true,
          count: ref.current.workflows.list.length,
          workflows: ref.current.workflows.list.map(brief),
        }),
      }),

      defineTool({
        name: "get_workflow",
        title: "Get a workflow",
        description:
          "Read a workflow in full: the intent behind it, the method, the ordered pattern, the " +
          "conventions worth preserving, guidance on adapting it, and the normalised record of what was " +
          "actually done. There is no replay tool and that is deliberate — apply the pattern to the " +
          "project that is open now using the editing tools, re-deriving timing, counts and geometry " +
          "from the current state. Geometry in the record is a fraction of the canvas, so it carries " +
          "across aspect ratios; element references point at the action that created the element.",
        schema: z.object({ workflowId: z.string().min(1) }).strict(),
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async ({ workflowId }) => {
          const w = await ref.current.workflows.get(workflowId);
          if (!w) return { ok: false, error: `No workflow with id ${workflowId}. Call list_workflows first.` };
          return {
            ok: true,
            ...brief(w),
            intent: w.intent,
            method: w.method,
            pattern: w.pattern,
            conventions: w.conventions,
            adaptation: w.adaptation,
            observed: w.observed,
          };
        },
      }),

      defineTool({
        name: "create_workflow_from_project",
        title: "Capture a workflow from a project",
        description:
          "Analyse what was done in a project and capture it as a workflow. The action log is distilled " +
          "deterministically — reads dropped, deleted work dropped, intermediate adjustments collapsed, " +
          "geometry normalised to canvas fractions — then analysed to describe the intent, method and " +
          "pattern. Needs a Gemini key, or the shared demo key when one is available. Defaults to the " +
          "open project.",
        schema: z.object({ projectId: z.string().min(1).optional() }).strict(),
        annotations: { untrustedContentHint: true },
        execute: async ({ projectId }, { signal }) => {
          const { projects, workflows, editorState } = ref.current;
          const target = projectId ?? projects.activeId;
          if (!target) return { ok: false, error: "No project is open and no projectId was given." };
          if (!canGenerate()) {
            return {
              ok: false,
              error:
                "No Gemini key is set. Capturing a workflow means analysing the session, so the user " +
                "must add a key in the editor header first.",
            };
          }

          const meta = projects.list.find((p) => p.id === target);
          const { events, trimmed } = await listEvents(target, 0, 100000);
          if (events.length === 0) {
            return { ok: false, error: "That project has no recorded actions yet. Edit something first." };
          }

          try {
            const { workflow, notes } = await analyseIntoWorkflow({
              events,
              logWasTrimmed: trimmed,
              projectId: target,
              projectName: meta?.name ?? "project",
              aspectRatio: (editorState()?.aspectRatio as any) ?? "16:9",
              assetKindById: Object.fromEntries(
                assetsRef.current.assets.map((a) => [a.id, a.type] as const)
              ),
              signal,
            });
            await workflows.save(workflow);
            return { ok: true, ...brief(workflow), intent: workflow.intent, distillationNotes: notes };
          } catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : "The analysis failed." };
          }
        },
      }),

      defineTool({
        name: "delete_workflow",
        title: "Delete a workflow",
        description: "Permanently delete a workflow. This cannot be undone. Requires the workflow id.",
        schema: z.object({ workflowId: z.string().min(1) }).strict(),
        execute: async ({ workflowId }) => {
          const removed = await ref.current.workflows.remove(workflowId);
          if (!removed) return { ok: false, error: `No workflow with id ${workflowId}.` };
          return { ok: true, deletedWorkflowId: workflowId };
        },
      }),

      defineTool({
        name: "get_project_events",
        title: "Get a project's action log",
        description:
          "The raw, ordered log of editing actions for a project, in tool vocabulary. get_workflow is " +
          "usually the better read — it is already analysed. Reach for this when you need ground truth " +
          "about a project that has no workflow captured yet. Paged: pass offset to continue.",
        schema: z.object({
          projectId: z.string().min(1).optional(),
          offset: z.number().int().min(0).max(100000).optional(),
          limit: z.number().int().min(1).max(200).optional(),
        }).strict(),
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async ({ projectId, offset, limit }) => {
          const target = projectId ?? ref.current.projects.activeId;
          if (!target) return { ok: false, error: "No project is open and no projectId was given." };
          const { events, total, trimmed } = await listEvents(target, offset ?? 0, limit ?? 100);
          return {
            ok: true,
            projectId: target,
            total,
            offset: offset ?? 0,
            returned: events.length,
            truncated: (offset ?? 0) + events.length < total,
            logWasTrimmed: trimmed,
            events: events.map((e) => ({
              seq: e.seq, at: new Date(e.ts).toISOString(), by: e.source,
              tool: e.tool, input: e.input, createdOverlayIds: e.producedOverlayIds,
            })),
          };
        },
      }),
    ];

    // `defineTool` has already registered these locally, which is what the
    // Workflows view uses. Only the browser handshake needs WebMCP.
    if (!modelContext) return () => registration.abort();

    Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: registration.signal })))
      .then(() => console.info(`[perpetual] ${tools.length} WebMCP workflow tools registered.`))
      .catch((error) => {
        if (!registration.signal.aborted) console.warn("[perpetual] Workflow tool registration failed.", error);
      });

    return () => registration.abort();
  }, []);

  return null;
}
