/**
 * Workflows view.
 *
 * A reading surface, not a control panel. A workflow is an encapsulation of
 * what someone did and why — there is no Run button, because applying it means
 * re-deriving the edit against whatever project is open, which is the agent's
 * job. What a human does here is capture one, read it, and delete it.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Layers, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { requestConfirm } from "@/local/confirm";
import type { Workflows } from "@/local/use-workflows";
import type { Workflow } from "@/local/types";

interface Props {
  workflows: Workflows;
  /** Capture from the open project. Null when no project is open. */
  onCapture: (() => Promise<any>) | null;
  /** Whether a Gemini key (or the shared demo key) is available. Reactive. */
  canAnalyse: boolean;
  /** Owned by the editor root, because History triggers capture too. */
  capture: { busy: boolean; message: string | null; lastId: string | null };
}

export function WorkflowsView({ workflows, onCapture, canAnalyse, capture }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const selected = useMemo(
    () => workflows.list.find((w) => w.id === selectedId) ?? null,
    [workflows.list, selectedId]
  );

  // A capture started from the History panel lands here, so open what it made.
  useEffect(() => {
    if (capture.lastId) setSelectedId(capture.lastId);
  }, [capture.lastId]);

  const message = capture.message && capture.message !== dismissed ? capture.message : null;

  if (selected) {
    return (
      <WorkflowDetail
        workflow={selected}
        onBack={() => { setSelectedId(null); setDismissed(capture.message); }}
        onDelete={async () => {
          const ok = await requestConfirm({
            title: `Delete "${selected.name}"?`,
            description: "The workflow is removed permanently. This cannot be undone. Your projects and media are untouched.",
            confirmLabel: "Delete workflow",
          });
          if (!ok) return;
          await workflows.remove(selected.id);
          setSelectedId(null);
        }}
      />
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Workflows</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              A workflow captures what you did in a project and why. Later, an agent asked to
              work "like that project" reads the pattern and applies it here — adapting to
              this project's footage, length and canvas rather than copying it.
            </p>
          </div>
          {onCapture && (
            <Button
              onClick={() => void onCapture()}
              disabled={capture.busy || !canAnalyse}
              size="sm"
              className="shrink-0 gap-1.5"
            >
              <Sparkles className="size-3.5" />
              {capture.busy ? "Analysing…" : "Capture this project"}
            </Button>
          )}
        </div>

        {!canAnalyse && (
          <p className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Capturing a workflow analyses your session, so it needs a Gemini key — add one from the
            editor header. Reading and deleting existing workflows works without it.
          </p>
        )}

        {message && (
          <p className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {message}
          </p>
        )}

        {!workflows.isReady ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : workflows.list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <Layers className="mx-auto mb-3 size-6 text-muted-foreground/60" />
            <p className="text-sm text-foreground">Nothing captured yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Edit a project the way you like it, then capture it. What gets stored is the
              approach — the intent, the order, the conventions — not the exact clicks.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {workflows.list.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className="flex w-full flex-col items-start gap-1 rounded-lg border border-border bg-card/40 px-4 py-3 text-left transition-colors hover:bg-muted/60"
              >
                <p className="truncate text-sm font-medium text-foreground">{w.name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{w.summary}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="px-1.5 font-normal">
                    {w.observed.actionCount} actions
                  </Badge>
                  <Badge variant="outline" className="px-1.5 font-normal">
                    {w.observed.aspectRatio}
                  </Badge>
                  {w.sourceProjectName && (
                    <span className="text-[11px] text-muted-foreground/70">from {w.sourceProjectName}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function WorkflowDetail({
  workflow, onBack, onDelete,
}: {
  workflow: Workflow;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [showRecord, setShowRecord] = useState(false);

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 gap-1.5" onClick={onBack}>
          <ArrowLeft className="size-3.5" /> All workflows
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{workflow.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{workflow.summary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="px-1.5 font-normal">
                {workflow.observed.actionCount} actions
              </Badge>
              <Badge variant="outline" className="px-1.5 font-normal">{workflow.observed.aspectRatio}</Badge>
              <Badge variant="outline" className="px-1.5 font-normal">
                {workflow.observed.timelineSeconds}s
              </Badge>
              {workflow.sourceProjectName && (
                <span className="text-[11px] text-muted-foreground/70">from {workflow.sourceProjectName}</span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 text-red-500 hover:text-red-500" onClick={onDelete} aria-label="Delete workflow">
            <Trash2 className="size-4" />
          </Button>
        </div>

        <Section title="Why">
          <p className="text-sm leading-relaxed text-foreground/90">{workflow.intent}</p>
        </Section>

        <Section title="How">
          <p className="text-sm leading-relaxed text-foreground/90">{workflow.method}</p>
        </Section>

        {workflow.pattern.length > 0 && (
          <Section title="Pattern">
            <ol className="space-y-1.5">
              {workflow.pattern.map((beat, i) => (
                <li key={i} className="flex gap-3 text-sm text-foreground/90">
                  <span className="w-4 shrink-0 text-muted-foreground">{i + 1}</span>
                  <span className="leading-relaxed">{beat}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {workflow.conventions.length > 0 && (
          <Section title="Conventions">
            <ul className="space-y-1.5">
              {workflow.conventions.map((c, i) => (
                <li key={i} className="flex gap-2 text-sm text-foreground/90">
                  <span className="text-muted-foreground">·</span>
                  <span className="leading-relaxed">{c}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Adapting it">
          <p className="text-sm leading-relaxed text-foreground/90">{workflow.adaptation}</p>
        </Section>

        <Section title="What was recorded">
          <button
            onClick={() => setShowRecord((v) => !v)}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            {showRecord ? "Hide" : "Show"} the normalised record ({workflow.observed.actions.length} actions)
          </button>
          {showRecord && (
            <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {JSON.stringify(workflow.observed.actions, null, 1)}
            </pre>
          )}
          {workflow.observed.logWasTrimmed && (
            <p className="mt-2 text-xs text-amber-500">
              The action log had been trimmed, so the earliest actions are missing from this analysis.
            </p>
          )}
        </Section>
      </div>
    </ScrollArea>
  );
}
