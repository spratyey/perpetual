"use client";

import Image from "next/image";
import Link from "next/link";
import { ShinyButton } from "@/components/magicui/shiny-button";
import { useEffect, useState } from "react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-7xl">
      <div
        className={`rounded-full border pl-3 pr-1.5 sm:pl-5 sm:pr-2 h-12 sm:h-14 flex items-center justify-between transition-all duration-300 ${
          scrolled
            ? "bg-background/80 backdrop-blur-xl border-border shadow-lg"
            : "bg-background/40 backdrop-blur-md border-border/50"
        }`}
      >
        <Link href="/" className="flex items-center min-w-0">
          <Image src="/logo_only.png" alt="perpetual.video" width={22} height={22} className="sm:w-[26px] sm:h-[26px] shrink-0" />
          <span className="text-lg sm:text-2xl pl-1.5 sm:pl-2 font-semibold tracking-tight truncate">
            perpetual.video
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-md text-muted-foreground">
          <a
            href="#features"
            className="hover:text-foreground transition-colors"
          >
            Features
          </a>
          <a
            href="#architecture"
            className="hover:text-foreground transition-colors"
          >
            Architecture
          </a>
        </div>

        <ShinyButton
          className="text-xs sm:text-sm rounded-full px-4 py-1.5 sm:px-6 sm:py-2 border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.2)] hover:shadow-[0_0_16px_rgba(249,115,22,0.35)] shrink-0"
          onClick={() => {
            const el = document.getElementById("join-waitlist");
            if (el) {
              el.scrollIntoView({ behavior: "smooth" });
              el.classList.add("animate-pulse");
              setTimeout(() => el.classList.remove("animate-pulse"), 2000);
            }
          }}
        >
          Join Waitlist
        </ShinyButton>
      </div>
    </nav>
  );
}
