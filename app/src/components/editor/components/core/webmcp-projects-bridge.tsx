/**
 * WebMCP project tools.
 *
 * Kept separate from the editing bridge on purpose. These tools describe the
 * catalogue, so they stay registered for the whole session — including when no
 * project is open, which is exactly when an agent needs them. The editing
 * tools live in `webmcp-bridge.tsx` and are only registered while a project is
 * open, so an agent can never call `add_text` with nowhere to put it.
 */

import { useEffect, useRef } from "react";
import { z } from "zod";
import type { Projects } from "@/local/use-projects";
import { defineTool, type ToolConfig } from "@/local/webmcp-tool";

const emptyInput = z.object({}).strict();
const projectName = z.string().trim().min(1).max(120);

export function WebMcpProjectsBridge({ projects }: { projects: Projects }) {
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  useEffect(() => {
    const modelContext = document.modelContext;
    const registration = new AbortController();

    const describe = (p: { id: string; name: string; createdAt: number; updatedAt: number }) => ({
      id: p.id,
      name: p.name,
      createdAt: new Date(p.createdAt).toISOString(),
      updatedAt: new Date(p.updatedAt).toISOString(),
      isOpen: p.id === projectsRef.current.activeId,
    });

    const tools: WebMCP.ModelContextTool[] = [
      defineTool({
        name: "list_projects",
        title: "List projects",
        description:
          "List every project stored in this browser, newest first, and say which one is currently open. Use this before switching or editing so you know what exists.",
        schema: emptyInput,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => {
          const current = projectsRef.current;
          return {
            ok: true,
            activeProjectId: current.activeId,
            count: current.list.length,
            projects: current.list.map(describe),
          };
        },
      }),

      defineTool({
        name: "create_project",
        title: "Create project",
        description:
          "Create a new, empty project and open it. The editing tools become available once a project is open. The imported media library is shared across projects.",
        schema: z.object({ name: projectName.optional() }).strict(),
        execute: async ({ name }) => {
          const meta = await projectsRef.current.create(name);
          return { ok: true, project: describe(meta), opened: true };
        },
      }),

      defineTool({
        name: "switch_project",
        title: "Switch project",
        description:
          "Open a different project by id. The timeline, history and activity feed are replaced by that project's own. Undo does not cross projects.",
        schema: z.object({ projectId: z.string().min(1) }).strict(),
        execute: ({ projectId }) => {
          const opened = projectsRef.current.open(projectId);
          if (!opened) return { ok: false, error: `No project with id ${projectId}. Call list_projects first.` };
          return { ok: true, projectId };
        },
      }),

      defineTool({
        name: "rename_project",
        title: "Rename project",
        description: "Rename a project. Defaults to the project that is currently open.",
        schema: z.object({ name: projectName, projectId: z.string().min(1).optional() }).strict(),
        execute: async ({ name, projectId }) => {
          const target = projectId ?? projectsRef.current.activeId;
          if (!target) return { ok: false, error: "No project is open and no projectId was given." };
          const meta = await projectsRef.current.rename(target, name);
          if (!meta) return { ok: false, error: `No project with id ${target}.` };
          return { ok: true, project: describe(meta) };
        },
      }),

      defineTool({
        name: "duplicate_project",
        title: "Duplicate project",
        description:
          "Copy a project's whole timeline into a new project and open it. Useful before trying a variant edit, since it keeps the original intact.",
        schema: z.object({ projectId: z.string().min(1).optional(), name: projectName.optional() }).strict(),
        execute: async ({ projectId, name }) => {
          const target = projectId ?? projectsRef.current.activeId;
          if (!target) return { ok: false, error: "No project is open and no projectId was given." };
          const meta = await projectsRef.current.duplicate(target, name);
          if (!meta) return { ok: false, error: `No project with id ${target}.` };
          return { ok: true, project: describe(meta), opened: true };
        },
      }),

      defineTool({
        name: "delete_project",
        title: "Delete project",
        description:
          "Permanently delete a project and its timeline. This cannot be undone. Imported media is kept, because the library is shared with other projects. Requires the project id, so confirm with the user which one you mean.",
        schema: z.object({ projectId: z.string().min(1) }).strict(),
        execute: async ({ projectId }) => {
          const removed = await projectsRef.current.remove(projectId);
          if (!removed) return { ok: false, error: `No project with id ${projectId}.` };
          return { ok: true, deletedProjectId: projectId, activeProjectId: projectsRef.current.activeId };
        },
      }),
    ];

    // `defineTool` has already put these in the local registry, which is what the
    // human UI and the workflow runner use. Only the browser handshake needs WebMCP.
    if (!modelContext) return () => registration.abort();

    Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: registration.signal })))
      .then(() => console.info(`[perpetual] ${tools.length} WebMCP project tools registered.`))
      .catch((error) => {
        if (!registration.signal.aborted) console.warn("[perpetual] Project tool registration failed.", error);
      });

    return () => registration.abort();
  }, []);

  return null;
}
