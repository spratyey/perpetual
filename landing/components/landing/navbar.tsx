"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * The nav had anchors to Features and Architecture and a "Join Waitlist"
 * button. All three are gone: there is no waitlist, and the sections those
 * anchors pointed at no longer exist — a nav link that scrolls nowhere is
 * worse than no nav link.
 */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className="fixed left-1/2 top-4 z-50 w-[calc(100%-1rem)] max-w-5xl -translate-x-1/2 sm:w-[calc(100%-2rem)]">
      <div
        className={`flex h-12 items-center justify-between rounded-full border pl-3 pr-1.5 transition-all duration-300 sm:h-14 sm:pl-5 sm:pr-2 ${
          scrolled
            ? "border-border bg-background/80 shadow-lg backdrop-blur-xl"
            : "border-border/50 bg-background/40 backdrop-blur-md"
        }`}
      >
        <Link href="/" className="flex min-w-0 items-center">
          <Image
            src="/mark.svg"
            alt=""
            width={24}
            height={14}
            className="shrink-0"
          />
          <span className="truncate pl-2 text-lg font-semibold tracking-tight sm:text-xl">
            perpetual.video
          </span>
        </Link>

        <Link
          href="https://app.perpetual.video"
          className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:px-5 sm:py-2 sm:text-sm"
        >
          Go to app
        </Link>
      </div>
    </nav>
  );
}
