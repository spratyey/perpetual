import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-32 pb-24 px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-12">Last updated: February 2026</p>

          <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">1. Information We Collect</h2>
              <p>
                When you use perpetual.video, we may collect information you provide directly, such as your
                name, email address, and any content you create within the editor. We also collect usage
                data including browser type, device information, and interaction patterns to improve the product.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Provide, maintain, and improve perpetual.video</li>
                <li>Process and complete transactions</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Analyze usage trends to improve user experience</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">3. Data Storage & Security</h2>
              <p>
                Your project files and media are stored securely. We implement industry-standard security
                measures to protect your personal information. However, no method of transmission over
                the internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">4. Third-Party Services</h2>
              <p>
                perpetual.video may integrate with third-party AI services for features like image generation,
                text-to-speech, and media understanding. When you use these features, your content may be
                processed by these third-party providers according to their respective privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">5. MCP & AI Agent Access</h2>
              <p>
                When AI agents interact with your projects via MCP, they access only the project data
                you explicitly share. We do not store or log the content of MCP interactions beyond
                what is necessary for the service to function.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">6. Your Rights</h2>
              <p>
                You have the right to access, correct, or delete your personal data at any time.
                You can export or delete your projects from the editor. To request data deletion,
                contact us at privacy@perpetual.video.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">7. Changes to This Policy</h2>
              <p>
                We may update this privacy policy from time to time. We will notify you of any
                changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">8. Contact</h2>
              <p>
                If you have questions about this privacy policy, please contact us at privacy@perpetual.video.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
