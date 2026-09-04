import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { DemoVideo } from "@/components/landing/demo-video";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <DemoVideo />
      </main>
      <Footer />
    </div>
  );
}
