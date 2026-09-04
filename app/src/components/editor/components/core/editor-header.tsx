import { Redo2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorContext } from "../../contexts/editor-context";
import { ApiKeysDialog } from "./api-keys-dialog";
import { Wordmark } from "@/components/brand/logo";
import { ProjectMenu } from "./project-menu";
import type { Projects } from "@/local/use-projects";

export function EditorHeader({
  projects, view, setView,
}: {
  projects: Projects;
  view: "editor" | "workflows";
  setView: (v: "editor" | "workflows") => void;
}) {
  const { undo, redo, canUndo, canRedo } = useEditorContext();

  return (
    <header className="relative z-20 flex shrink-0 items-center gap-2 border-b border-border bg-background p-2.5 px-4">
      <Wordmark className="h-4" />

      <span className="mx-1 select-none text-sm text-muted-foreground/50">/</span>

      <ProjectMenu projects={projects} />

      <div className="ml-2 flex items-center gap-0.5">
        <TooltipProvider delayDuration={50}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={undo} disabled={!canUndo} size="icon" variant="ghost" className="h-8 w-8">
                <Undo2 className="h-4 w-4" strokeWidth={2} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span className="flex items-center gap-1">
                Undo
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">⌘Z</kbd>
              </span>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={redo} disabled={!canRedo} size="icon" variant="ghost" className="h-8 w-8">
                <Redo2 className="h-4 w-4" strokeWidth={2} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span className="flex items-center gap-1">
                Redo
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">⌘Y</kbd>
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex-grow" />

      <div className="mr-2 flex items-center rounded-md border border-border p-0.5">
        {(["editor", "workflows"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={
              "rounded px-2.5 py-1 text-xs capitalize transition-colors " +
              (view === v ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")
            }
          >
            {v}
          </button>
        ))}
      </div>

      <ApiKeysDialog />

    </header>
  );
}
