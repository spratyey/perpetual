/**
 * Project switcher for the editor header.
 *
 * Deliberately plain: the interesting behaviour lives in `useProjects`, and
 * both this menu and the WebMCP project tools drive the same functions, so a
 * human switch and an agent switch are the same operation.
 */

import { useState } from "react";
import { Check, ChevronDown, Copy, FolderPlus, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Projects } from "@/local/use-projects";
import { requestConfirm } from "@/local/confirm";

export function ProjectMenu({ projects }: { projects: Projects }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");

  const active = projects.active;

  const commitRename = async () => {
    const name = draft.trim();
    setRenaming(false);
    if (!active || !name || name === active.name) return;
    await projects.rename(active.id, name);
  };

  if (renaming && active) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commitRename();
          if (e.key === "Escape") setRenaming(false);
        }}
        className="h-7 w-44 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
        aria-label="Project name"
      />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-foreground hover:bg-muted transition-colors">
        <span className="max-w-44 truncate font-medium">{active?.name ?? "No project"}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Projects ({projects.list.length})
        </DropdownMenuLabel>

        <div className="max-h-64 overflow-y-auto">
          {projects.list.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onSelect={() => projects.open(p.id)}
              className="flex items-center gap-2"
            >
              <Check className={`size-3.5 shrink-0 ${p.id === projects.activeId ? "opacity-100" : "opacity-0"}`} />
              <span className="flex-1 truncate">{p.name}</span>
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => void projects.create()} className="gap-2">
          <FolderPlus className="size-3.5" />
          New project
        </DropdownMenuItem>

        {active && (
          <>
            <DropdownMenuItem
              onSelect={() => {
                setDraft(active.name);
                setRenaming(true);
              }}
              className="gap-2"
            >
              <Pencil className="size-3.5" />
              Rename
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={() => void projects.duplicate(active.id)} className="gap-2">
              <Copy className="size-3.5" />
              Duplicate
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={() => {
                void (async () => {
                  const ok = await requestConfirm({
                    title: `Delete "${active.name}"?`,
                    description:
                      "The project and its timeline are removed permanently. This cannot be undone. Imported media is kept, because the library is shared with your other projects.",
                    confirmLabel: "Delete project",
                  });
                  if (ok) await projects.remove(active.id);
                })();
              }}
              className="gap-2 text-red-500 focus:text-red-500"
            >
              <Trash2 className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Shown when the browser holds no projects yet. */
export function NoProjects({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex items-center gap-2">
        <img src="/mark.svg" alt="" className="size-7" />
        <span className="text-lg font-semibold">perpetual</span>
      </div>
      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-semibold text-foreground">No projects yet</h1>
        <p className="text-sm text-muted-foreground">
          Create a project to start editing. Everything stays in this browser — there is no server and
          nothing is uploaded.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <FolderPlus className="size-4" />
        Create project
      </button>
      <p className="max-w-sm text-xs text-muted-foreground/60">
        An AI agent can also do this for you — with WebMCP enabled, ask it to create a project.
      </p>
    </div>
  );
}
