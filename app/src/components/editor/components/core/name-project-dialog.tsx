/**
 * First-run naming prompt.
 *
 * A project created without a name is called "Untitled". Rather than leaving
 * the user staring at that, ask once — the first thing they see. Skipping is
 * allowed and remembered, so the prompt never becomes a wall: it is a
 * suggestion, not a gate, and the editor is fully usable behind it.
 */

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Projects } from "@/local/use-projects";

const DISMISSED_KEY = "perpetual:naming-dismissed";

function wasDismissed(id: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]") as string[]).includes(id);
  } catch {
    return false;
  }
}

function markDismissed(id: string): void {
  try {
    const seen = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]") as string[];
    if (!seen.includes(id)) localStorage.setItem(DISMISSED_KEY, JSON.stringify([...seen, id]));
  } catch {
    // Storage refused; the prompt reappearing is a smaller problem than crashing.
  }
}

export function NameProjectDialog({ projects }: { projects: Projects }) {
  const active = projects.active;
  const needsName = !!active && active.name === "Untitled" && !wasDismissed(active.id);

  const [open, setOpen] = useState(needsName);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Opens for a newly created "Untitled" project too, not only on first load.
  useEffect(() => {
    setOpen(needsName);
    setDraft("");
  }, [needsName, active?.id]);

  if (!open || !active) return null;

  const close = () => {
    markDismissed(active.id);
    setOpen(false);
  };

  const submit = async () => {
    const name = draft.trim();
    if (!name) return close();
    setSaving(true);
    await projects.rename(active.id, name);
    markDismissed(active.id);
    setSaving(false);
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-project-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 id="name-project-title" className="text-lg font-semibold text-foreground">
          Name your project
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Give it something you'll recognise later. You can rename it any time from the header.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="mt-5 space-y-3"
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
            }}
            placeholder="Launch teaser"
            maxLength={120}
            disabled={saving}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary"
            aria-label="Project name"
          />

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving || !draft.trim()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Continue"}
              {!saving && <ArrowRight className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
