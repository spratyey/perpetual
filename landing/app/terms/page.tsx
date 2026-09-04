import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-32 pb-24 px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-12">Last updated: February 2026</p>

          <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing or using perpetual.video, you agree to be bound by these Terms of Service.
                If you do not agree to these terms, you may not use the service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
              <p>
                perpetual.video is a video editing platform that provides both a visual editor interface
                for human users and an MCP server for AI agent integration. The service allows
                creation, editing, and composition of video projects.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">3. User Content</h2>
              <p>
                You retain all rights to the content you create using perpetual.video. You are solely
                responsible for the content you produce, including ensuring you have the necessary
                rights to any media assets you import into the editor.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">4. AI-Generated Content</h2>
              <p>
                Content generated through AI features (image generation, text-to-speech, music generation)
                is subject to the terms of the underlying AI providers. You are responsible for
                reviewing and ensuring appropriate use of AI-generated content.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">5. MCP Access</h2>
              <p>
                Access to the MCP server is provided for legitimate video editing automation purposes.
                You agree not to use MCP access to abuse, overload, or interfere with the service.
                Rate limits and usage quotas may apply.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">6. Prohibited Uses</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Use the service for any unlawful purpose</li>
                <li>Attempt to reverse engineer or extract source code</li>
                <li>Interfere with or disrupt the service or its infrastructure</li>
                <li>Create content that infringes on others&apos; intellectual property</li>
                <li>Use the service to generate harmful, abusive, or misleading content</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">7. Limitation of Liability</h2>
              <p>
                perpetual.video is provided &quot;as is&quot; without warranties of any kind. We shall not be liable
                for any indirect, incidental, special, or consequential damages arising from your use
                of the service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">8. Changes to Terms</h2>
              <p>
                We reserve the right to modify these terms at any time. Continued use of the service
                after changes constitutes acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">9. Contact</h2>
              <p>
                For questions about these terms, please contact us at legal@perpetual.video.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
