/**
 * perpetual.video brand marks.
 *
 * Four blocks of increasing width: a frame becoming a shot. Drawn as SVG so
 * they stay sharp at any size and inherit the current text colour.
 */

export function Mark({ className = "h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 41 24" className={className} role="img" aria-label="perpetual.video" fill="currentColor">
      <rect x="0" y="0" width="2" height="24" />
      <rect x="5" y="0" width="4" height="24" />
      <rect x="12" y="0" width="8" height="24" />
      <rect x="23" y="0" width="18" height="24" />
    </svg>
  );
}

export function Wordmark({ className = "h-4" }: { className?: string }) {
  return (
    <span className="flex select-none items-center gap-1.5 font-sans font-bold tracking-tight text-foreground">
      <span className="text-sm leading-none">perpetual</span>
      <Mark className={className} />
      <span className="text-sm leading-none">video</span>
    </span>
  );
}
