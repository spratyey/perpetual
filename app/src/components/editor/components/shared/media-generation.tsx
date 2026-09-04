import React, { useState } from "react";
import { Loader2, Sparkles, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useGenerationStore, type GenerationJob, type GenerationKind } from "@/local/generation-store";

const PLACEHOLDER: Record<GenerationKind, string> = {
  image: "Describe an image…",
  video: "Describe a shot…",
};

function elapsedLabel(job: GenerationJob): string {
  const seconds = job.elapsed || Math.round((Date.now() - job.startedAt) / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

const JobCard: React.FC<{ job: GenerationJob; onOpen: () => void }> = ({ job, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className={`group relative flex aspect-video flex-col items-center justify-center overflow-hidden border bg-muted/40 text-center ${
      job.status === "error" ? "border-destructive/60" : "border-border"
    }`}
  >
    {job.status === "pending" && <Skeleton className="absolute inset-0 rounded-none" />}
    <div className="relative flex flex-col items-center gap-1.5 px-2">
      {job.status === "pending" ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <X className="h-4 w-4 text-destructive" />
      )}
      <span className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">{job.prompt}</span>
    </div>
    <span className="absolute bottom-1 right-1.5 text-[9px] tabular-nums text-muted-foreground">
      {job.status === "pending" ? elapsedLabel(job) : "Failed"}
    </span>
  </button>
);

const JobDialog: React.FC<{
  job: GenerationJob;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ job, open, onOpenChange }) => {
  const { cancel, dismiss } = useGenerationStore();
  const rows: [string, string][] = [
    ["Model", job.model],
    ["Shape", job.durationSeconds ? `${job.aspectRatio}, ${job.durationSeconds}s` : job.aspectRatio],
    ["Started by", job.source === "agent" ? "The agent" : "You"],
    ["Waiting", elapsedLabel(job)],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {job.kind === "video" ? "Video" : "Image"}
            <Badge variant={job.status === "error" ? "destructive" : "secondary"}>
              {job.status === "error" ? "Failed" : "Working"}
            </Badge>
          </DialogTitle>
          <DialogDescription>{job.prompt}</DialogDescription>
        </DialogHeader>

        <dl className="divide-y divide-border border border-border text-xs">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-3 px-3 py-2">
              <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>

        {job.error && <p className="text-xs text-destructive">{job.error}</p>}

        <DialogFooter className="gap-2 sm:justify-between">
          {job.status === "pending" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { cancel(job.id); onOpenChange(false); }}
            >
              Cancel request
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => { dismiss(job.id); onOpenChange(false); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Dismiss
            </Button>
          )}
          <Button size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * The prompt box and the jobs still in flight. A finished job leaves this
 * section and appears in the media grid above, which is where anything gets
 * added to the timeline.
 */
export const MediaGeneration: React.FC<{ kind: GenerationKind }> = ({ kind }) => {
  const { jobs, generate } = useGenerationStore();
  const [prompt, setPrompt] = useState("");
  const [openJobId, setOpenJobId] = useState<string | null>(null);

  const mine = jobs.filter((job) => job.kind === kind);
  const openJob = mine.find((job) => job.id === openJobId);

  const submit = () => {
    const text = prompt.trim();
    if (!text) return;
    setPrompt("");
    void generate({ kind, prompt: text, source: "human" });
  };

  return (
    <div className="shrink-0 space-y-3">
      <div className="flex gap-2">
        <Input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") submit(); }}
          placeholder={PLACEHOLDER[kind]}
          className="h-8 text-xs"
        />
        <Button size="sm" className="h-8 shrink-0 gap-1.5" disabled={!prompt.trim()} onClick={submit}>
          <Sparkles className="h-3.5 w-3.5" />
          Generate
        </Button>
      </div>

      {mine.length > 0 && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-2">
            {mine.map((job) => (
              <JobCard key={job.id} job={job} onOpen={() => setOpenJobId(job.id)} />
            ))}
          </div>
        </>
      )}

      {openJob && (
        <JobDialog job={openJob} open onOpenChange={(open) => setOpenJobId(open ? openJob.id : null)} />
      )}
    </div>
  );
};
