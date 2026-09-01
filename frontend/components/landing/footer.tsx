import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 sm:gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Image src="/logo_only.png" alt="perpetual.video" width={28} height={28} />
              <span className="text-lg font-semibold">perpetual.video</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-55">
              A video editor where humans and AI are both first-class citizens.
            </p>
            <a
              href="https://x.com/perpetual_video"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 mt-3 text-sm transition-colors"
              aria-label="Follow us on X"
            >
              <span className="animate-gradient-flow font-medium">Follow us on</span>
              <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                <defs>
                  <linearGradient id="x-gradient-footer" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f97316">
                      <animate attributeName="stop-color" values="#a1a1aa;#f97316;#facc15;#f97316;#a1a1aa" dur="3s" repeatCount="indefinite" />
                    </stop>
                    <stop offset="100%" stopColor="#facc15">
                      <animate attributeName="stop-color" values="#f97316;#facc15;#f97316;#a1a1aa;#f97316" dur="3s" repeatCount="indefinite" />
                    </stop>
                  </linearGradient>
                </defs>
                <path fill="url(#x-gradient-footer)" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>

          <div className="flex gap-16">
            {/* Product */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Product
              </h4>
              <ul className="space-y-2.5">
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Studio</a></li>
                <li><a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#architecture" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Architecture</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Legal
              </h4>
              <ul className="space-y-2.5">
                <li><Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border/50">
          <span className="text-sm text-muted-foreground/50">
            &copy; {new Date().getFullYear()} perpetual.video
          </span>
        </div>
      </div>
    </footer>
  );
}
