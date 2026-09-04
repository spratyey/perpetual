/**
 * Shared tool definition, registry and recording.
 *
 * Both bridges define tools through `defineTool` here, which gives three things
 * one home:
 *
 * 1. **Validation** — Zod in, JSON Schema out, one error format.
 * 2. **A registry** — so the app's own UI can call a tool by name and take
 *    exactly the same path an agent does.
 * 3. **Recording** — every write tool call is appended to the durable event log
 *    a workflow is captured from. Doing it here means it cannot drift as tools
 *    are added, and it captures post-validation input.
 * 4. **Visibility** — every call is announced on the activity channel, so an
 *    agent's work is never silent. Same argument as recording: per-tool
 *    emission had drifted until eleven of thirty tools showed nothing.
 *
 * Reads are not recorded, decided by the `readOnlyHint` annotation the tools
 * already carry rather than a second list. See PLANS/workflows.md §4.1.
 */

import { z } from "zod";
import { emitActivity, type ReportStage } from "./activity";
import { appendEvent, trimEvents } from "./persistence";

/**
 * Which tools create an overlay, and where the new id sits in their result.
 * Declared rather than inferred: the event log records what an action created,
 * so distillation can say which later action targeted it.
 */
const PRODUCES_OVERLAY: Record<string, (result: any) => number | undefined> = {
  add_text: (r) => r?.result?.id,
  add_shape: (r) => r?.result?.id,
  add_asset: (r) => r?.result?.id,
  duplicate_overlay: (r) => r?.result?.id,
  split_overlay: (r) => r?.result?.second?.id ?? r?.result?.first?.id,
};

export interface ToolConfig<TSchema extends z.ZodType> {
  name: string;
  title: string;
  description: string;
  schema: TSchema;
  annotations?: WebMCP.ToolAnnotations;
  /**
   * `report` publishes a progress stage for a long job. Optional to use; a tool
   * that never calls it just shows its label until it finishes.
   */
  execute: (
    input: z.output<TSchema>,
    options: WebMCP.ToolExecuteCallbackOptions,
    report: ReportStage
  ) => unknown | Promise<unknown>;
}

interface Registered {
  tool: WebMCP.ModelContextTool;
  schema: z.ZodType;
  readOnly: boolean;
  /** Bypasses recording: workflow machinery must not log into its own source. */
  neverRecord: boolean;
}

const registry = new Map<string, Registered>();

/** Tools that manage the library, not the video. Never recorded. */
const NEVER_RECORD = new Set([
  "list_projects", "create_project", "switch_project", "rename_project",
  "duplicate_project", "delete_project",
  "list_workflows", "get_workflow", "delete_workflow",
  "create_workflow_from_project", "get_project_events",
  "undo", "redo",
]);

/**
 * Where recording writes to. Set by the app; null when no project is open, so
 * nothing is recorded against nothing.
 */
let recordingContext: { projectId: string | null; revision: () => number } | null = null;

export function setRecordingContext(ctx: { projectId: string | null; revision: () => number } | null): void {
  recordingContext = ctx;
}


function validationMessage(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
}

export function defineTool<TSchema extends z.ZodType>({
  schema, execute, ...tool
}: ToolConfig<TSchema>): WebMCP.ModelContextTool {
  const readOnly = !!tool.annotations?.readOnlyHint;
  const neverRecord = NEVER_RECORD.has(tool.name);

  const definition: WebMCP.ModelContextTool = {
    ...tool,
    inputSchema: z.toJSONSchema(schema),
    execute: async (input, options) => {
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        // Announced, so a malformed agent call is visible rather than a no-op.
        const invocationId = crypto.randomUUID();
        emitActivity({ toolName: tool.name, status: "started", invocationId, readOnly });
        emitActivity({ toolName: tool.name, status: "error", invocationId, readOnly });
        return { ok: false, error: validationMessage(parsed.error) };
      }

      const invocationId = crypto.randomUUID();
      emitActivity({ toolName: tool.name, status: "started", invocationId, readOnly });
      const report: ReportStage = (stage) =>
        emitActivity({ toolName: tool.name, status: "started", invocationId, stage, readOnly });

      let result: unknown;
      try {
        result = await execute(parsed.data, options, report);
      } catch (err) {
        // A tool that throws rather than returning `{ ok: false }` still has to
        // close its toast, or it spins forever.
        emitActivity({ toolName: tool.name, status: "error", invocationId, readOnly });
        throw err;
      }

      const failed = !!result && typeof result === "object" && (result as any).ok === false;
      emitActivity({
        toolName: tool.name,
        status: failed ? "error" : "completed",
        invocationId,
        readOnly,
      });

      const shouldRecord =
        !readOnly && !neverRecord && !failed &&
        recordingContext?.projectId && !!result && typeof result === "object";

      if (shouldRecord) {
        const extract = PRODUCES_OVERLAY[tool.name];
        const produced = extract?.(result);
        void appendEvent({
          projectId: recordingContext!.projectId!,
          ts: Date.now(),
          source: "agent",
          tool: tool.name,
          input: parsed.data as Record<string, unknown>,
          producedOverlayIds: produced === undefined ? undefined : [produced],
          revision: recordingContext!.revision(),
        }).then((seq) => {
          const pid = recordingContext?.projectId;
          if (seq > 0 && seq % 200 === 0 && pid) void trimEvents(pid);
        });
      }

      return result;
    },
  };

  registry.set(tool.name, { tool: definition, schema, readOnly, neverRecord });
  return definition;
}

// ─── Registry access ───

export function hasTool(name: string): boolean {
  return registry.has(name);
}

export function toolNames(): string[] {
  return [...registry.keys()].sort();
}

/**
 * Calls a registered tool directly.
 *
 * Used by the app's own UI so a button and an agent take exactly the same path:
 * one implementation, one set of validation and error messages.
 */
export async function invokeLocalTool(name: string, input: unknown): Promise<any> {
  const entry = registry.get(name);
  if (!entry) return { ok: false, error: `There is no tool called "${name}".` };
  return entry.tool.execute(input as Record<string, unknown>, { signal: new AbortController().signal });
}

/** Validates a step input without running anything. Returns null when valid. */
export function validateToolInput(name: string, input: unknown): string | null {
  const entry = registry.get(name);
  if (!entry) return `there is no tool called "${name}"`;
  const parsed = entry.schema.safeParse(input);
  return parsed.success ? null : validationMessage(parsed.error);
}


