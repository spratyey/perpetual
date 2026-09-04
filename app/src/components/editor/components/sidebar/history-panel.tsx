/**
 * History panel.
 *
 * Lives in the left sidebar with the other panels rather than in a header
 * dropdown or the old right-hand panel: it is a list you browse, so it belongs
 * where the other browsable lists are, and it scrolls in place.
 *
 * Every change is here in order with its author, and picking one restores the
 * project to that point.
 */

import React, { useMemo } from "react";
import { User, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useEditorContext } from "../../contexts/editor-context";
import type { HistoryEntry } from "@/local/use-local-project";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const SourceBadge: React.FC<{ source: HistoryEntry["source"] }> = ({ source }) => {
  if (source === "system") return <Badge variant="outline" className="px-1.5 font-normal">Start</Badge>;
  if (source === "agent") {
    return (
      <Badge variant="default" className="gap-1 px-1.5">
        <Zap className="h-3 w-3" />
        Agent
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 px-1.5">
      <User className="h-3 w-3" />
      You
    </Badge>
  );
};

export const HistoryPanel: React.FC = () => {
  const { historyEntries, historyPointer, jumpToHistory, onCreateWorkflow } = useEditorContext();
  const entries = historyEntries ?? [];
  const pointer = historyPointer ?? 0;

  const rows = useMemo(
    () => entries.map((entry, index) => ({ entry, index })).reverse(),
    [entries]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-1 pb-3">
        <p className="text-xs text-muted-foreground">
          Every change, newest first. Pick one to restore the project to that point.
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 pr-2">
          {rows.length === 0 ? (
            <p className="px-1 py-4 text-xs text-muted-foreground">Nothing yet.</p>
          ) : (
            rows.map(({ entry, index }) => {
              const isCurrent = index === pointer;
              const isFuture = index > pointer;
              return (
                <button
                  key={entry.id}
                  onClick={() => jumpToHistory?.(entry.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:bg-muted",
                    isCurrent && "border-border bg-muted/60",
                    isFuture && "opacity-45"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-foreground">{entry.label}</span>
                    {entry.detail && (
                      <p className="truncate text-[11px] text-muted-foreground">{entry.detail}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1.5">
                      <SourceBadge source={entry.source} />
                      <span className="text-[10px] text-muted-foreground">{formatTime(entry.ts)}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>

      {onCreateWorkflow && (
        <div className="shrink-0 border-t border-border pt-3">
          <button
            onClick={onCreateWorkflow}
            className="w-full rounded-md border border-border px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted"
          >
            Capture a workflow from this project
          </button>
        </div>
      )}
    </div>
  );
};
