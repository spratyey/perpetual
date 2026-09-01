# perpetual.video — landing page

Next.js 16 (App Router, React 19, Tailwind v4, shadcn/ui) deployed to
**Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).

## Local development

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

To run the actual Workers runtime locally (closer to production):

```bash
pnpm preview        # opennext build + wrangler dev
```

## Deploying

CI does this on every push to `main` — see `.github/workflows/deploy.yml`.
To deploy by hand:

```bash
pnpm deploy         # opennext build + wrangler deploy
```

### One-time Cloudflare setup

This deploys to the same Cloudflare account as the VibeMotion apps
(`vibemotion-studio`), which is also where the `vibemotion.ai` zone lives.

1. Create an API token at **Cloudflare dashboard → My Profile → API Tokens**
   using the *Edit Cloudflare Workers* template, scoped to that account.
2. Add it as a repo secret: `gh secret set CLOUDFLARE_API_TOKEN`.
   (`CLOUDFLARE_ACCOUNT_ID` is already set.)
3. Push to `main`. The site lands on `perpetual-web.<subdomain>.workers.dev`.

Because the logged-in Cloudflare user has more than one account, local
`pnpm deploy` needs the account picked explicitly:

```bash
export CLOUDFLARE_ACCOUNT_ID=<the account running vibemotion-studio>
```

### Attaching perpetual.video

Once the domain is on the Cloudflare account, uncomment the `routes` block in
`wrangler.jsonc` and redeploy. No code changes needed.

## Waitlist

**Not wired up yet.** The previous stack used MongoDB + nodemailer, neither of
which runs on the Workers runtime (raw TCP / SMTP are unavailable). The form in
`components/landing/cta.tsx` currently tells visitors the waitlist isn't open —
it does not silently drop emails. To bring it back, add an
`app/api/waitlist/route.ts` backed by a Workers-compatible store (D1 or KV) and
an HTTP mailer (Resend), then restore the fetch call in `CTA`.
