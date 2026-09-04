/**
 * App shell.
 *
 * Owns the project catalogue and decides what is on screen: nothing while the
 * catalogue loads, the empty state when there are no projects, otherwise the
 * editor for the open one.
 *
 * The project tools are registered here rather than inside the editor, so an
 * agent can create or switch a project even when no editor is mounted. The 18
 * editing tools live inside `PerpetualEditor` and therefore only exist while a
 * project is actually open — an agent cannot call `add_text` into nothing.
 */

import PerpetualEditor from "./react-video-editor";
import { WebMcpProjectsBridge } from "./components/core/webmcp-projects-bridge";
import { NoProjects } from "./components/core/project-menu";
import { NameProjectDialog } from "./components/core/name-project-dialog";
import { useProjects } from "@/local/use-projects";
import { isEphemeral } from "@/local/persistence";

export default function PerpetualApp() {
  const projects = useProjects();

  return (
    <>
      <WebMcpProjectsBridge projects={projects} />

      {projects.isReady && isEphemeral() && (
        /*
         * Stated, not discovered. In a context that refuses storage the editor
         * works completely and saves nothing, which is a fine trade only if
         * the person knows before they spend an hour on a cut.
         */
        <div className="fixed inset-x-0 top-0 z-50 bg-amber-500/15 px-4 py-1.5 text-center text-xs text-amber-700 dark:text-amber-300">
          This browser will not give the page storage, so nothing is being saved. Editing works, but
          reloading loses the project.
        </div>
      )}

      {!projects.isReady ? (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm">Opening your projects…</p>
          </div>
        </div>
      ) : projects.activeId === null ? (
        <NoProjects onCreate={() => void projects.create()} />
      ) : (
        <>
          <PerpetualEditor projects={projects} />
          <NameProjectDialog projects={projects} />
        </>
      )}
    </>
  );
}
