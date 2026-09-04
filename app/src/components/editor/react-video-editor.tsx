/**
 * Editor root.
 *
 * Ported from the original editor. The layout, the providers and the
 * context surface are unchanged; what has gone is the WebSocket sync, the
 * autosave loop, the render pipeline, the AI studios, the workflow recorder
 * and the multi-video state. Mutations now go straight into the local
 * project store, which is also what the WebMCP tools write to.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SidebarInset, SidebarProvider as UISidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/sidebar/app-sidebar";
import { EditorCanvas, EditorTimeline } from "./components/core/editor";
import { EditorHeader } from "./components/core/editor-header";
import { WebMcpBridge } from "./components/core/webmcp-bridge";
import { WebMcpWorkflowsBridge } from "./components/core/webmcp-workflows-bridge";
import { WorkflowsView } from "./components/core/workflows-view";
import { PanelErrorBoundary } from "./components/core/panel-error-boundary";
import { SidebarProvider as EditorSidebarProvider } from "./contexts/sidebar-context";

import { EditorProvider } from "./contexts/editor-context";
import { PathEditProvider } from "./contexts/path-edit-context";
import { TimelineProvider, useTimeline } from "./contexts/timeline-context";
import { AssetLoadingProvider } from "./contexts/asset-loading-context";
import { AssetStoreProvider } from "@/local/asset-store";
import { AnalysisStoreProvider } from "@/local/analysis-store";
import { CaptionStoreProvider } from "@/local/caption-store";
import { GenerationStoreProvider } from "@/local/generation-store";
import { AssetRelinker } from "@/local/asset-relinker";
import { ConfirmHost } from "@/local/confirm";
import { McpActivityToast } from "./components/core/mcp-activity-toast";

import { useVideoPlayer } from "./hooks/use-video-player";
import { useTimelineClick } from "./hooks/use-timeline-click";
import { useAspectRatio, setSharedAspectRatio } from "./hooks/use-aspect-ratio";
import { useCompositionDuration } from "./hooks/use-composition-duration";
import { useGlobalHotkeys } from "./hooks/use-global-hotkeys";

import { FPS } from "./constants";
import type { AspectRatio, CaptionStyles, Overlay } from "./types";
import { useLocalProject, type LocalProject } from "@/local/use-local-project";
import type { Projects } from "@/local/use-projects";
import { useWorkflows } from "@/local/use-workflows";
import { setRecordingContext, invokeLocalTool } from "@/local/webmcp-tool";
import { useAssetStore } from "@/local/asset-store";
import { useCanGenerate } from "@/local/gemini";
import type { BackgroundConfig } from "@/local/types";

/**
 * The tool call a human click is equivalent to.
 *
 * Recording in tool vocabulary is what lets a hand-edited session extract into a
 * workflow — see PLANS/workflows.md §4.1. Only fields the corresponding tool
 * actually accepts are included, so the recorded action stays meaningful.
 */
function toolFor(overlay: any): { tool?: string; toolInput?: Record<string, unknown> } {
  const timing = {
    fromSeconds: +(overlay.from / FPS).toFixed(3),
    durationSeconds: +(overlay.durationInFrames / FPS).toFixed(3),
    row: overlay.row ?? 0,
  };
  const box = {
    left: Math.round(overlay.left), top: Math.round(overlay.top),
    width: Math.round(overlay.width), height: Math.round(overlay.height),
    rotation: overlay.rotation ?? 0,
  };
  if (overlay.type === "text") {
    return { tool: "add_text", toolInput: { content: String(overlay.content ?? ""), ...timing, ...box } };
  }
  if (overlay.type === "shape") {
    return { tool: "add_shape", toolInput: { shape: String(overlay.content ?? "rectangle"), ...timing, ...box } };
  }
  if (overlay.assetId) {
    return { tool: "add_asset", toolInput: { assetId: overlay.assetId, ...timing } };
  }
  // Anything else has no tool equivalent; logged as unknown and skipped.
  return {};
}

/** The subset of an update the `update_overlay` tool accepts. */
function geometryOf(updates: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ["left", "top", "width", "height", "rotation", "opacity", "volume", "speed", "color", "fontSize"]) {
    if (updates?.[k] !== undefined) out[k] = typeof updates[k] === "number" ? Math.round(updates[k] * 1000) / 1000 : updates[k];
  }
  if (typeof updates?.content === "string") out.content = updates.content;
  return out;
}

/** Invisible component that activates global keyboard shortcuts inside EditorProvider. */
function GlobalHotkeys() {
  useGlobalHotkeys();
  return null;
}

function EditorLayout({
  project,
  projects,
  view,
  setView,
  workflows,
  onCaptureWorkflow,
  capture,
}: {
  project: LocalProject;
  projects: Projects;
  view: "editor" | "workflows";
  setView: (v: "editor" | "workflows") => void;
  workflows: ReturnType<typeof useWorkflows>;
  onCaptureWorkflow: () => Promise<any>;
  capture: { busy: boolean; message: string | null; lastId: string | null };
}) {
  const { leftFullHeight, rightFullHeight } = useTimeline();
  // A Gemini key, or the shared demo key when one is configured.
  const canCapture = useCanGenerate();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden" style={{ "--header-height": "53px" } as React.CSSProperties}>
      <EditorHeader projects={projects} view={view} setView={setView} />
      {view === "workflows" ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <PanelErrorBoundary label="Workflows">
            <WorkflowsView
              workflows={workflows}
              onCapture={onCaptureWorkflow}
              canAnalyse={canCapture}
              capture={capture}
            />
          </PanelErrorBoundary>
        </div>
      ) : null}
      {view === "workflows" ? null : (<>
      {!leftFullHeight && !rightFullHeight ? (
        <>
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <UISidebarProvider className="min-h-0 flex-1 !min-h-0 overflow-hidden">
              <AppSidebar />
              <SidebarInset className="!min-h-0">
                <EditorCanvas />
              </SidebarInset>
            </UISidebarProvider>
          </div>
          <EditorTimeline />
        </>
      ) : leftFullHeight && !rightFullHeight ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <UISidebarProvider className="min-h-0 flex-1 !min-h-0 overflow-hidden">
            <AppSidebar />
            <SidebarInset className="!min-h-0" style={{ minHeight: 0 }}>
              <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="min-w-0 flex-1 overflow-hidden">
                  <EditorCanvas />
                </div>
              </div>
              <EditorTimeline />
            </SidebarInset>
          </UISidebarProvider>
        </div>
      ) : !leftFullHeight && rightFullHeight ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <UISidebarProvider className="min-h-0 flex-1 !min-h-0 overflow-hidden">
                <AppSidebar />
                <SidebarInset className="!min-h-0">
                  <EditorCanvas />
                </SidebarInset>
              </UISidebarProvider>
            </div>
            <EditorTimeline />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <UISidebarProvider className="min-h-0 flex-1 !min-h-0 overflow-hidden">
            <AppSidebar />
            <SidebarInset className="!min-h-0" style={{ minHeight: 0 }}>
              <EditorCanvas />
              <EditorTimeline />
            </SidebarInset>
          </UISidebarProvider>
        </div>
      )}
      </>)}
    </div>
  );
}

export default function PerpetualEditor({ projects }: { projects: Projects }) {
  const project = useLocalProject(projects.activeId);
  const workflows = useWorkflows();
  const [view, setView] = useState<"editor" | "workflows">("editor");

  const [capture, setCapture] = useState<{ busy: boolean; message: string | null; lastId: string | null }>(
    { busy: false, message: null, lastId: null }
  );

  /**
   * Capture goes through the tool, so this button and an agent take exactly the
   * same path — one implementation, one set of error messages. Held here rather
   * than inside the Workflows view because the History panel triggers it too.
   */
  const captureWorkflow = useCallback(async () => {
    setCapture({ busy: true, message: null, lastId: null });
    const r = await invokeLocalTool("create_workflow_from_project", {});
    setCapture({
      busy: false,
      message: r?.ok ? `Captured "${r.name}".` : (r?.error ?? "Could not capture a workflow."),
      lastId: r?.ok ? (r.workflowId ?? null) : null,
    });
    void workflows.refresh();
    return r;
  }, [workflows]);
  const { doc, dispatch } = project;

  const [selectedOverlayId, setSelectedOverlayId] = useState<number | null>(null);
  const [selectedOverlayIds, setSelectedOverlayIds] = useState<number[]>([]);

  // Overlay ids are per-document, so a selection carried across a project
  // switch would point at a different overlay — or none.
  useEffect(() => {
    setSelectedOverlayId(null);
    setSelectedOverlayIds([]);
  }, [projects.activeId]);

  const overlays = doc.overlays;
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;

  const { isPlaying, currentFrame, playerRef, togglePlayPause, formatTime } = useVideoPlayer();
  const { durationInFrames, timelineDurationInFrames, durationInSeconds } = useCompositionDuration(overlays);
  const { playerDimensions, updatePlayerDimensions, getAspectRatioDimensions } = useAspectRatio();

  // Agent tool calls are recorded against the open project. Cleared on unmount so
  // nothing is logged while no editor exists.
  const entriesRef = useRef(project.entries);
  entriesRef.current = project.entries;
  const pointerRef = useRef(project.pointer);
  pointerRef.current = project.pointer;
  useEffect(() => {
    setRecordingContext({
      projectId: project.projectId,
      revision: () => entriesRef.current[pointerRef.current]?.revision ?? 0,
    });
    return () => setRecordingContext(null);
  }, [project.projectId]);

  // The document owns the canvas shape; the shared hook store mirrors it.
  useEffect(() => { setSharedAspectRatio(doc.aspectRatio); }, [doc.aspectRatio]);

  const describeContent = (content: unknown) =>
    typeof content === "string" && content && !content.startsWith("data:") ? content.slice(0, 60) : undefined;

  const describe = useCallback((id: number) => {
    const overlay = overlaysRef.current.find((o) => o.id === id);
    return overlay ? `#${id} ${overlay.type}` : `#${id}`;
  }, []);

  // ─── Human-sourced commands ───

  const addOverlay = useCallback((overlay: Overlay) => {
    dispatch({ action: "add-overlay", payload: overlay }, {
      source: "human",
      label: `Added ${overlay.type}`,
      // A clip carries its thumbnail in `content`, which is no use as a caption.
      detail: describeContent((overlay as any).content),
      ...toolFor(overlay),
    });
  }, [dispatch]);

  const changeOverlay = useCallback(
    (id: number, updater: Partial<Overlay> | ((prev: Overlay) => Overlay)) => {
      const current = overlaysRef.current.find((o) => o.id === id);
      if (!current) return;
      const updates = typeof updater === "function" ? updater(current) : updater;
      dispatch({ action: "update-overlay", overlayId: id, updates }, {
        source: "human",
        label: "Changed overlay",
        detail: describe(id),
        coalesceKey: `update:${id}`,
        tool: "update_overlay",
        toolInput: { overlayId: id, ...geometryOf(updates) },
      });
    },
    [dispatch, describe]
  );

  const handleOverlayChange = useCallback((updated: Overlay) => {
    changeOverlay(updated.id, updated);
  }, [changeOverlay]);

  const deleteOverlay = useCallback((id: number) => {
    const detail = describe(id);
    dispatch({ action: "delete-overlay", overlayId: id }, {
      source: "human", label: "Deleted overlay", detail,
      tool: "delete_overlay", toolInput: { overlayId: id },
    });
    setSelectedOverlayId((prev) => (prev === id ? null : prev));
    setSelectedOverlayIds((prev) => prev.filter((value) => value !== id));
  }, [dispatch, describe]);

  const duplicateOverlay = useCallback((id: number) => {
    dispatch({ action: "duplicate-overlay", overlayId: id }, {
      source: "human", label: "Duplicated overlay", detail: describe(id),
      tool: "duplicate_overlay", toolInput: { overlayId: id },
    });
  }, [dispatch, describe]);

  const splitOverlay = useCallback((id: number, splitFrame: number) => {
    dispatch({ action: "split-overlay", overlayId: id, splitFrame }, {
      source: "human", label: "Split overlay", detail: describe(id),
      tool: "split_overlay", toolInput: { overlayId: id, timeSeconds: +(splitFrame / FPS).toFixed(3) },
    });
  }, [dispatch, describe]);

  const batchUpdate = useCallback(
    (updates: Array<{ id: number; overlay: Partial<Overlay> }>, newOverlay?: any) => {
      const mutations = updates.map(({ id, overlay }) => ({
        action: "update-overlay" as const,
        overlayId: id,
        updates: overlay,
      }));
      if (newOverlay) mutations.push({ action: "add-overlay", payload: newOverlay } as any);
      dispatch({ action: "batch", mutations }, {
        source: "human",
        label: newOverlay ? "Moved clips" : "Moved clips",
        detail: `${mutations.length} change${mutations.length > 1 ? "s" : ""}`,
        coalesceKey: "batch",
      });
    },
    [dispatch]
  );

  const deleteOverlaysByRow = useCallback((row: number) => {
    const targets = overlaysRef.current.filter((o) => o.row === row);
    if (!targets.length) return;
    dispatch(
      { action: "batch", mutations: targets.map((o) => ({ action: "delete-overlay" as const, overlayId: o.id })) },
      { source: "human", label: "Cleared a row", detail: `row ${row + 1}` }
    );
  }, [dispatch]);

  const updateOverlayStyles = useCallback((overlayId: number, styles: Partial<CaptionStyles>) => {
    dispatch({ action: "update-overlay", overlayId, updates: { styles } }, {
      source: "human",
      label: "Restyled overlay",
      detail: describe(overlayId),
      coalesceKey: `style:${overlayId}`,
    });
  }, [dispatch, describe]);

  const setOverlays = useCallback((next: Overlay[]) => {
    project.setDocSilently((prev) => ({ ...prev, overlays: next }));
  }, [project]);

  const setBackground = useCallback((background: BackgroundConfig) => {
    dispatch({ action: "set-background", payload: background }, {
      source: "human",
      label: "Set background",
      detail: background.type,
      coalesceKey: "background",
    });
  }, [dispatch]);

  const setAspectRatio = useCallback((ratio: AspectRatio) => {
    dispatch({ action: "set-aspect-ratio", ratio }, {
      source: "human", label: "Set aspect ratio", detail: ratio,
      tool: "set_aspect_ratio", toolInput: { aspectRatio: ratio },
    });
  }, [dispatch]);

  const handleTimelineClick = useTimelineClick(playerRef, timelineDurationInFrames);

  const editorContextValue = useMemo(() => ({
    overlays,
    setOverlays,
    selectedOverlayId,
    setSelectedOverlayId,
    selectedOverlayIds,
    setSelectedOverlayIds,
    changeOverlay,
    handleOverlayChange,
    addOverlay,
    deleteOverlay,
    duplicateOverlay,
    splitOverlay,
    resetOverlays: () => {},
    getDefaultOverlays: () => [] as Overlay[],
    batchUpdate,

    isPlaying,
    currentFrame,
    playerRef,
    togglePlayPause,
    formatTime,
    handleTimelineClick,

    aspectRatio: doc.aspectRatio,
    setAspectRatio,
    playerDimensions,
    updatePlayerDimensions,
    getAspectRatioDimensions,
    durationInFrames,
    timelineDurationInFrames,
    durationInSeconds,

    deleteOverlaysByRow,

    undo: project.undo,
    redo: project.redo,
    canUndo: project.canUndo,
    canRedo: project.canRedo,

    updateOverlayStyles,

    background: doc.background,
    setBackground,

    seekTo: (frame: number) => { playerRef.current?.seekTo(frame); },

    historyEntries: project.entries,
    historyPointer: project.pointer,
    jumpToHistory: project.jumpTo,
    onCreateWorkflow: () => { setView("workflows"); void captureWorkflow(); },

    projectId: project.projectId ?? undefined,
    // The catalogue owns the name; doc.name is only the value set at creation.
    projectName: projects.active?.name ?? doc.name,
  }), [
    overlays, setOverlays, selectedOverlayId, selectedOverlayIds, changeOverlay, handleOverlayChange,
    addOverlay, deleteOverlay, duplicateOverlay, splitOverlay, batchUpdate, isPlaying, currentFrame,
    playerRef, togglePlayPause, formatTime, handleTimelineClick, doc.aspectRatio, doc.background, doc.name,
    project.projectId, projects.active?.name,
    project.entries, project.pointer, project.jumpTo, captureWorkflow,
    setAspectRatio, playerDimensions, updatePlayerDimensions, getAspectRatioDimensions, durationInFrames,
    timelineDurationInFrames, durationInSeconds, deleteOverlaysByRow, project.undo, project.redo,
    project.canUndo, project.canRedo, updateOverlayStyles, setBackground,
  ]);

  /**
   * The toast sits above the ready/not-ready split, and above every provider.
   *
   * It listens to a window event, so it needs no context — and it must not
   * share a lifetime with the project subtree. `isReady` goes false while a
   * project loads, which unmounts everything below it: mounted any lower, the
   * one class of tool that changes project (`create_project`, `switch_project`)
   * tore down its own reporter mid-call and could never show that it finished.
   */
  return (
    <>
      <McpActivityToast />
      {!project.isReady ? (
        <div className="flex h-screen w-full items-center justify-center bg-background text-sm text-muted-foreground">
          Loading project…
        </div>
      ) : (
    <UISidebarProvider style={{ "--sidebar-width": "350px" } as React.CSSProperties}>
    <EditorSidebarProvider>
      <TimelineProvider>
        <EditorProvider value={editorContextValue as any}>
          <AssetStoreProvider>
            <AnalysisStoreProvider>
            <AssetRelinker project={project}>
              <CaptionStoreProvider project={project}>
              <GenerationStoreProvider>
              <WebMcpBridge project={project} />
              <WebMcpWorkflowsBridge
                deps={{
                  workflows,
                  projects,
                  editorState: () => ({ aspectRatio: project.getDoc().aspectRatio }),
                }}
              />
              <GlobalHotkeys />
              <PathEditProvider>
                <AssetLoadingProvider>
                  <EditorLayout
                    project={project}
                    projects={projects}
                    view={view}
                    setView={setView}
                    workflows={workflows}
                    onCaptureWorkflow={captureWorkflow}
                    capture={capture}
                  />
                </AssetLoadingProvider>
              </PathEditProvider>
              <ConfirmHost />
              </GenerationStoreProvider>
              </CaptionStoreProvider>
            </AssetRelinker>
            </AnalysisStoreProvider>
          </AssetStoreProvider>
        </EditorProvider>
      </TimelineProvider>
    </EditorSidebarProvider>
    </UISidebarProvider>
      )}
    </>
  );
}

export { FPS };
