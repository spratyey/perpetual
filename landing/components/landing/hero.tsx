/**
 * Hero.
 *
 * This used to be a 534-line animated mock of the editor — two coloured
 * cursors moving over a fake timeline. That existed to show what the product
 * did before there was anything to show. There is a real demo video directly
 * below now, so the animation was competing with the truth and losing.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="px-4 pt-32 pb-12 sm:px-6 sm:pt-40">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="mb-5 text-3xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
          A video editor built equally
          <br />
          for humans and AI
        </h1>

        <p className="mx-auto mb-8 max-w-xl text-base text-muted-foreground sm:text-lg">
          Edit it yourself, or let an agent edit it with you through WebMCP — both work on the
          same project, at the same time. Everything stays in your browser.
        </p>

        <Link
          href="https://app.perpetual.video"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:text-base"
        >
          Go to app
          <ArrowRight className="size-4" />
        </Link>

        <p className="mt-4 text-xs text-muted-foreground">
          No sign-up. Nothing is uploaded.
        </p>
      </div>
    </section>
  );
}
