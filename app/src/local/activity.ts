/**
 * The activity channel — one window event, two ends.
 *
 * Every tool call announces itself here and `McpActivityToast` renders it. It
 * is a DOM CustomEvent rather than a context because the emitting end is
 * `defineTool`, a plain module with no React above it.
 *
 * Nothing calls this directly any more: emission belongs to `defineTool`, for
 * the same reason recording does. Eleven of thirty tools once had no UI at all
 * — every project and workflow tool — because each new tool had to remember to
 * opt in, and the ones added last didn't. Emitting from the wrapper means a
 * tool cannot be invisible, including tools not written yet.
 */

export type ActivityStatus = "started" | "completed" | "error";

export interface ActivityDetail {
  toolName: string;
  status: ActivityStatus;
  /** Pairs `started` with its `completed`, so concurrent calls don't cross. */
  invocationId: string;
  /**
   * What a long job is doing right now — "Transcribing", "Isolating subject".
   * Preferred over the tool's static label while it is running, because
   * "Adding captions…" for eighty-five seconds tells you nothing.
   */
  stage?: string;
  /** Read-only calls are noise; the toast uses this to stay quiet. */
  readOnly?: boolean;
  timestamp: number;
}

export const ACTIVITY_EVENT = "mcp-tool-activity";

export function emitActivity(detail: Omit<ActivityDetail, "timestamp">): void {
  window.dispatchEvent(
    new CustomEvent<ActivityDetail>(ACTIVITY_EVENT, {
      detail: { ...detail, timestamp: Date.now() },
    })
  );
}

/** How a tool reports progress mid-run. */
export type ReportStage = (stage: string) => void;
