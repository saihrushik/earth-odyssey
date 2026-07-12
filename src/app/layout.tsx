import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Earth Odyssey — AI-powered 3D travel discovery",
  description:
    "Orbit a living digital Earth, discover destinations as glowing hotspots, and let a RAG-powered AI travel copilot fly you to your next journey.",
  openGraph: {
    title: "Earth Odyssey — AI-powered 3D travel discovery",
    description:
      "Orbit a living digital Earth, discover destinations as glowing hotspots, and let a RAG-powered AI travel copilot fly you to your next journey.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
