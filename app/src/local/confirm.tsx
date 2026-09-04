/**
 * Confirmation gate.
 *
 * WebMCP annotations are only hints — the draft has no field that forces a
 * browser prompt before a write. Anything that costs money or leaves the
 * machine therefore asks for confirmation inside the app first.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmRequest {
  title: string;
  description: string;
  facts?: { label: string; value: string }[];
  confirmLabel?: string;
}

type Handler = (request: ConfirmRequest) => Promise<boolean>;

let activeHandler: Handler | null = null;
/** One dialog at a time: a second request waits rather than replacing the first. */
let queue: Promise<unknown> = Promise.resolve();

export function requestConfirm(request: ConfirmRequest): Promise<boolean> {
  const ask = () => (activeHandler ? activeHandler(request) : Promise.resolve(false));
  const answer = queue.then(ask, ask);
  queue = answer.catch(() => undefined);
  return answer;
}

export const ConfirmHost: React.FC = () => {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  useEffect(() => {
    activeHandler = (next) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setRequest(next);
      });
    return () => { activeHandler = null; };
  }, []);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  return (
    <AlertDialog open={!!request} onOpenChange={(open) => { if (!open) settle(false); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {request?.facts?.length ? (
          <dl className="border border-border divide-y divide-border text-xs">
            {request.facts.map((fact) => (
              <div key={fact.label} className="flex gap-3 px-3 py-2">
                <dt className="w-20 shrink-0 text-muted-foreground">{fact.label}</dt>
                <dd className="min-w-0 break-words text-foreground">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => settle(true)}>{request?.confirmLabel ?? "Continue"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
