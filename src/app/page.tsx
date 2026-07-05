import type { Metadata } from "next";
import OdysseyExperience from "@/features/odyssey/OdysseyExperience";

export const metadata: Metadata = {
  title: "Earth Odyssey — AI-powered 3D travel discovery",
  description:
    "Orbit a living digital Earth, discover destinations as glowing hotspots, and let a RAG-powered AI travel copilot fly you to your next journey.",
};

export default function Home() {
  return <OdysseyExperience />;
}
