import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://perpetual.video";
const title = "perpetual.video — Video Editor Built for Humans & AI";
const description =
  "Edit visually or let AI compose via MCP — both work on the same project, in real time. The first video editor designed equally for humans and AI agents.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | perpetual.video",
  },
  description,
  keywords: [
    "video editor",
    "AI video editor",
    "MCP video editing",
    "AI agent video",
    "video editing tool",
    "perpetual.video",
    "perpetual video editor",
    "AI video composition",
    "real-time video editing",
    "human AI collaboration",
    "video timeline editor",
  ],
  authors: [{ name: "perpetual.video" }],
  creator: "perpetual.video",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "perpetual.video",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/logo_only.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster theme="dark" richColors />
      </body>
    </html>
  );
}
