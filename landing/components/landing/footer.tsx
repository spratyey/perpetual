import Image from "next/image";
import Link from "next/link";

/**
 * The Product column pointed at `#features`, `#architecture` and a bare `#`.
 * Those sections are gone and the `#` never went anywhere, so the column is
 * gone with them; Privacy and Terms are real routes and stay. The X mark's
 * animated orange gradient is now a flat currentColor, to match the editor.
 */
export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-12 sm:py-14">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Image src="/mark.svg" alt="" width={24} height={14} />
              <span className="text-lg font-semibold">perpetual.video</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              A video editor where humans and agents are both first-class citizens.
            </p>
          </div>

          <div className="flex gap-12">
            <div>
              <h4 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Perpetual
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <a href="https://app.perpetual.video" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Open the app
                  </a>
                </li>
                <li>
                  <a href="https://github.com/spratyey/perpetual" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Source
                  </a>
                </li>
                <li>
                  <a
                    href="https://x.com/perpetual_video"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden="true">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    @perpetual_video
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Legal
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-border/50 pt-6">
          <span className="text-sm text-muted-foreground/50">
            &copy; {new Date().getFullYear()} perpetual.video
          </span>
        </div>
      </div>
    </footer>
  );
}
