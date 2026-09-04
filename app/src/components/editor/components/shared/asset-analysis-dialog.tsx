/**
 * Content inspector.
 *
 * The human view of what Gemini found in one asset. Every segment can be put
 * on the timeline on its own, which is the same cut the agent makes when it
 * calls add_asset with a source range.
 */

import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AssetAnalysis } from "@/local/analysis";
import type { LoadedAsset } from "@/local/asset-store";

function clock(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

export const AssetAnalysisDialog: React.FC<{
  asset: LoadedAsset;
  analysis: AssetAnalysis;
  onAddRange: (range: { startSeconds: number; endSeconds: number }) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ asset, analysis, onAddRange, open, onOpenChange }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="truncate">{asset.name}</DialogTitle>
        <DialogDescription>Indexed by {analysis.model}. This stays in your browser.</DialogDescription>
      </DialogHeader>

      <p className="text-xs leading-relaxed text-foreground">{analysis.summary}</p>

      {analysis.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {analysis.tags.map((tag) => (
            <span key={tag} className="border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      {analysis.segments.length > 0 && (
        <ScrollArea className="max-h-[320px] border border-border">
          <ul className="divide-y divide-border">
            {analysis.segments.map((segment) => (
              <li key={segment.id} className="flex items-start gap-2 px-2.5 py-2">
                <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {clock(segment.startSeconds)}–{clock(segment.endSeconds)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] leading-snug text-foreground">{segment.description}</p>
                  {segment.transcript && (
                    <p className="mt-0.5 text-[10px] italic leading-snug text-muted-foreground">
                      {segment.speaker ? `${segment.speaker}: ` : ""}“{segment.transcript}”
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-2 text-[10px]"
                  onClick={() =>
                    onAddRange({ startSeconds: segment.startSeconds, endSeconds: segment.endSeconds })
                  }
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </DialogContent>
  </Dialog>
);
