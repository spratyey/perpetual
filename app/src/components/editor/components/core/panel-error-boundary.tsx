/**
 * Panel error boundary.
 *
 * Without one, a render error anywhere unmounts the entire React tree and the
 * page goes blank — which is exactly what a single stale workflow record did:
 * one `undefined.actionCount` in a list took down the editor, the timeline and
 * the header with it.
 *
 * A view failing should cost you that view, not the app. The recovery hint
 * matters too: most failures of this kind come from data written by an older
 * version of the app, and clearing local data is the fix a user can actually
 * apply.
 */

import React from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  /** Named in the message, so it is clear what broke. */
  label: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class PanelErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[perpetual] ${this.props.label} failed to render.`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-full min-h-0 items-center justify-center p-6">
        <div className="max-w-sm space-y-3 text-center">
          <AlertTriangle className="mx-auto size-5 text-amber-500" />
          <p className="text-sm font-medium text-foreground">{this.props.label} could not be shown</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The rest of the editor is unaffected. This usually means data saved by an older
            version of the app — the details are in the browser console.
          </p>
          <p className="font-mono text-[11px] leading-relaxed text-muted-foreground/70">
            {error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
