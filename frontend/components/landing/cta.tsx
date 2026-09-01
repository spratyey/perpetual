"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, ArrowRight, Sparkles } from "lucide-react";

export function CTA() {
  const [email, setEmail] = useState("");
  const [videoType, setVideoType] = useState("");
  // Kept so the success + loading UI stays in place for when the backend returns.
  const [isSubmitted] = useState(false);
  const [isLoading] = useState(false);

  // TODO: waitlist backend not wired up yet. The Mongo + nodemailer route from the
  // previous stack can't run on Cloudflare Workers; replace this with a call to the
  // new /api/waitlist once it's rebuilt on a Workers-compatible store + mailer.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    toast.info("The waitlist isn't open yet — check back shortly.");
  };

  return (
    <section id="join-waitlist" className="py-24 sm:py-32 px-4 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        {!isSubmitted ? (
          <>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 mb-6">
              <Sparkles className="size-3.5 text-accent" />
              <span className="text-xs font-medium text-accent/90 tracking-wide uppercase">
                Early Access
              </span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
              Get early access
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base mb-10 max-w-md mx-auto leading-relaxed">
              Be among the first to edit videos with AI. Join the waitlist and
              we&apos;ll let you know when it&apos;s ready.
            </p>

            <form
              onSubmit={handleSubmit}
              className="max-w-md mx-auto space-y-3"
            >
              <div className="relative flex items-center rounded-full border border-border bg-card/50 backdrop-blur-sm p-1.5 focus-within:border-accent/40 transition-colors">
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
                  disabled={isLoading}
                  required
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="shrink-0 flex items-center gap-2 rounded-full bg-accent hover:bg-accent/90 active:bg-accent/80 px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    "Joining..."
                  ) : (
                    <>
                      Join
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </button>
              </div>

              <input
                type="text"
                placeholder="What videos will you create? (optional)"
                value={videoType}
                onChange={(e) => setVideoType(e.target.value)}
                className="w-full rounded-full border border-border bg-card/30 px-5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-border/80 transition-colors"
                disabled={isLoading}
              />
            </form>

            <p className="text-[11px] text-muted-foreground/40 mt-4">
              No spam, unsubscribe anytime.
            </p>
          </>
        ) : (
          <div className="py-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 mb-5">
              <Check className="w-7 h-7 text-green-400" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold mb-2">
              You&apos;re on the list!
            </h3>
            <p className="text-muted-foreground text-sm">
              We&apos;ll notify you when perpetual.video is ready for early access.
            </p>
            {videoType && (
              <p className="text-sm text-muted-foreground/80 bg-accent/5 border border-accent/10 rounded-full px-5 py-2 mt-5 inline-block">
                We&apos;ll prioritize features for{" "}
                <span className="font-medium text-accent">
                  &quot;{videoType}&quot;
                </span>{" "}
                videos
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
