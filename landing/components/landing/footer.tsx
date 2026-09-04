import Image from "next/image";
import Link from "next/link";

/**
 * Brand, the two legal pages, copyright. Nothing else.
 *
 * The Product column pointed at sections that no longer exist, and the socials
 * and source link went too — the page already has two "Go to app" buttons, so
 * a third link to the same place plus an X profile was noise competing with
 * the one action that matters.
 */
export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Image src="/mark.svg" alt="" width={22} height={13} />
          <span className="text-sm font-semibold">perpetual.video</span>
        </div>

        <div className="flex items-center gap-6">
          <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Terms
          </Link>
          <span className="text-sm text-muted-foreground/50">
            &copy; {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </footer>
  );
}
