import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { DemoVideo } from "@/components/landing/demo-video";
import { Features } from "@/components/landing/features";
import { Architecture } from "@/components/landing/architecture";
import { CTA } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <DemoVideo />
      <Features />
      <Architecture />
      <CTA />
      <Footer />
    </div>
  );
}
