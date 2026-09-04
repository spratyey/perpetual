import * as React from "react";
import { Loader2, CheckCircle2, XCircle, Wrench } from "lucide-react";

interface ToastItem {
  /** Unique key per invocation */
  id: string;
  toolName: string;
  status: "started" | "completed" | "error";
  /** When the client received the started event */
  startedAt: number;
  /** Optional version name when editing a non-active version */
  videoName?: string;
  /** Latest progress stage reported by a long-running tool. */
  stage?: string;
}

/** For aggregated display: group concurrent same-tool toasts */
interface AggregatedToast {
  toolName: string;
  /** How many are in-progress */
  active: number;
  /** How many completed */
  completed: number;
  /** How many errored */
  errored: number;
  /** Total in this batch */
  total: number;
  /** Overall status for display */
  status: "started" | "completed" | "error";
  /** Display key */
  key: string;
  /** Earliest startedAt for ordering */
  startedAt: number;
  /** Version name if targeting a specific version */
  videoName?: string;
  /** Most recent stage among the grouped calls. */
  stage?: string;
}

/**
 * What each tool is called while it runs and once it has run.
 *
 * An explicit pair rather than deriving the past tense from the present: the
 * derivation was a regex over a verb table, which silently fell through to the
 * present tense for any verb not listed — so a new tool read "Capturing a
 * workflow" after it had finished. Two words per tool is cheaper than that.
 */
const TOOL_LABELS: Record<string, { run: string; done: string }> = {
  // Reading
  get_editor_state: { run: "Reading editor state", done: "Read editor state" },
  list_assets: { run: "Reading media list", done: "Read media list" },
  get_asset_analysis: { run: "Reading media index", done: "Read media index" },
  search_content: { run: "Searching media", done: "Searched media" },
  // Timeline
  seek: { run: "Seeking", done: "Seeked" },
  add_text: { run: "Adding text", done: "Added text" },
  add_shape: { run: "Adding shape", done: "Added shape" },
  add_asset: { run: "Adding media", done: "Added media" },
  update_overlay: { run: "Updating overlay", done: "Updated overlay" },
  delete_overlay: { run: "Deleting overlay", done: "Deleted overlay" },
  duplicate_overlay: { run: "Duplicating overlay", done: "Duplicated overlay" },
  split_overlay: { run: "Cutting overlay", done: "Cut overlay" },
  arrange_timeline: { run: "Rearranging timeline", done: "Rearranged timeline" },
  set_background: { run: "Setting background", done: "Set background" },
  set_aspect_ratio: { run: "Setting aspect ratio", done: "Set aspect ratio" },
  undo: { run: "Undoing", done: "Undone" },
  redo: { run: "Redoing", done: "Redone" },
  // Paid / slow
  generate_image: { run: "Generating image", done: "Generated image" },
  analyze_assets: { run: "Indexing media", done: "Indexed media" },
  generate_video: { run: "Generating video", done: "Generated video" },
  add_kinetic_captions: { run: "Adding captions", done: "Added captions" },
  list_generations: { run: "Listing generations", done: "Listed generations" },
  import_from_url: { run: "Fetching media", done: "Imported media" },
  // Projects
  list_projects: { run: "Listing projects", done: "Listed projects" },
  create_project: { run: "Creating project", done: "Created project" },
  switch_project: { run: "Opening project", done: "Opened project" },
  rename_project: { run: "Renaming project", done: "Renamed project" },
  duplicate_project: { run: "Duplicating project", done: "Duplicated project" },
  delete_project: { run: "Deleting project", done: "Deleted project" },
  // Workflows
  list_workflows: { run: "Listing workflows", done: "Listed workflows" },
  get_workflow: { run: "Reading workflow", done: "Read workflow" },
  create_workflow_from_project: { run: "Capturing workflow", done: "Captured workflow" },
  delete_workflow: { run: "Deleting workflow", done: "Deleted workflow" },
  get_project_events: { run: "Reading session log", done: "Read session log" },
};

/**
 * Reads that finish in a millisecond and would only flicker. Deliberately not
 * "every read": indexing and search are reads worth watching.
 */
const SILENT_TOOLS = new Set([
  "get_editor_state", "list_assets", "seek", "list_projects",
  "list_workflows", "get_workflow", "get_project_events", "get_asset_analysis",
]);

function getLabel(
  toolName: string,
  status: string,
  count?: number,
  stage?: string
): string {
  const pair = TOOL_LABELS[toolName];
  const base = pair?.run ?? toolName.replace(/_/g, " ");

  let label: string;
  if (status === "completed") {
    label = pair?.done ?? base;
  } else if (status === "error") {
    label = `${base} failed`;
  } else {
    // A stage says what an 85-second job is doing now; the label only says what
    // it is. Prefer the stage while running.
    label = `${stage ?? base}...`;
  }
  if (count && count > 1) label += ` (${count})`;
  return label;
}

export function McpActivityToast() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const seenIdsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (!data || SILENT_TOOLS.has(data.toolName)) return;

      // Use invocationId if available (from worker), fall back to toolName+timestamp
      const id: string = data.invocationId || `${data.toolName}-${data.timestamp}`;

      const videoName: string | undefined = data.videoName;
      const stage: string | undefined = data.stage;

      setToasts((prev) => {
        if (data.status === "started") {
          // A repeat `started` for a known id is a progress report, not a new
          // call — update the stage in place rather than dropping it.
          if (seenIdsRef.current.has(id)) {
            if (!stage) return prev;
            const at = prev.findIndex((t) => t.id === id);
            if (at === -1) return prev;
            const next = [...prev];
            next[at] = { ...next[at], stage };
            return next;
          }
          seenIdsRef.current.add(id);
          return [...prev, { id, toolName: data.toolName, status: "started", startedAt: Date.now(), videoName, stage }];
        }

        // completed/error: find matching started toast
        const idx = prev.findIndex((t) => t.id === id);
        if (idx === -1) {
          // No started toast — show directly
          if (seenIdsRef.current.has(`done-${id}`)) return prev;
          seenIdsRef.current.add(`done-${id}`);
          return [...prev, { id, toolName: data.toolName, status: data.status, startedAt: Date.now(), videoName, stage }];
        }

        const updated = [...prev];
        updated[idx] = { ...updated[idx], status: data.status };
        return updated;
      });
    };

    window.addEventListener("mcp-tool-activity", handler);
    return () => window.removeEventListener("mcp-tool-activity", handler);
  }, []);

  // Auto-dismiss completed/error toasts after 2s
  React.useEffect(() => {
    const finished = toasts.filter((t) => t.status === "completed" || t.status === "error");
    if (finished.length === 0) return;

    const timers = finished.map((t) =>
      setTimeout(() => {
        setToasts((prev) => prev.filter((p) => p.id !== t.id));
        seenIdsRef.current.delete(t.id);
        seenIdsRef.current.delete(`done-${t.id}`);
      }, 2000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  /**
   * The 400ms debounce below is evaluated at render time, and nothing else
   * re-renders while a tool is simply working. Without this tick a slow tool
   * that reports no stage — capturing a workflow, say — stayed invisible until
   * the moment it finished, which is precisely when the spinner stops being
   * useful. Ticks only while something is in flight.
   */
  const hasActive = toasts.some((t) => t.status === "started");
  const [, forceRender] = React.useState(0);
  React.useEffect(() => {
    if (!hasActive) return;
    const tick = setInterval(() => forceRender((n) => n + 1), 300);
    return () => clearInterval(tick);
  }, [hasActive]);

  // Clean up stale seen IDs
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (seenIdsRef.current.size > 200) seenIdsRef.current.clear();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Aggregate: group by toolName, collapse concurrent same-tool toasts into one row
  const aggregated = React.useMemo(() => {
    const groups = new Map<string, ToastItem[]>();
    for (const t of toasts) {
      const list = groups.get(t.toolName) || [];
      list.push(t);
      groups.set(t.toolName, list);
    }

    const result: AggregatedToast[] = [];
    for (const [toolName, items] of groups) {
      const active = items.filter((i) => i.status === "started").length;
      const completed = items.filter((i) => i.status === "completed").length;
      const errored = items.filter((i) => i.status === "error").length;
      const total = items.length;
      const earliest = Math.min(...items.map((i) => i.startedAt));

      let status: "started" | "completed" | "error";
      if (active > 0) status = "started";
      else if (errored > 0 && completed === 0) status = "error";
      else status = "completed";

      const videoName = items.find((i) => i.videoName)?.videoName;
      // The newest stage among the group, so a batch reports its live step.
      const stage = [...items].reverse().find((i) => i.stage)?.stage;
      result.push({ toolName, active, completed, errored, total, status, key: toolName, startedAt: earliest, videoName, stage });
    }

    return result.sort((a, b) => a.startedAt - b.startedAt);
  }, [toasts]);

  // Filter: hide "started" groups less than 400ms old
  const now = Date.now();
  const visible = aggregated
    .filter((t) => {
      if (t.status === "started" && now - t.startedAt < 400) return false;
      return true;
    })
    .slice(-5);

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {visible.map((toast) => {
        // For in-progress batches, show progress like "Importing media... (3/8)"
        const showProgress = toast.total > 1 && toast.status === "started";
        const progressLabel = showProgress
          ? `${toast.completed + toast.errored}/${toast.total}`
          : undefined;

        return (
          <div
            key={toast.key}
            className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg shadow-lg border border-border bg-card text-card-foreground text-sm animate-in slide-in-from-right-5 fade-in duration-200"
          >
            {toast.status === "started" && (
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            )}
            {toast.status === "completed" && (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            )}
            {toast.status === "error" && (
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
            )}
            <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate max-w-[260px]">
              {getLabel(toast.toolName, toast.status, toast.total > 1 ? toast.total : undefined, toast.stage)}
              {toast.videoName && (
                <span className="text-muted-foreground"> in {toast.videoName}</span>
              )}
            </span>
            {progressLabel && (
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {progressLabel}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
