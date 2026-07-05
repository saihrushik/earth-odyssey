import type { ChapterId } from "@/features/odyssey/data/types";

/** Globe-control actions the copilot can emit; applied by the client store. */
export type GlobeAction =
  | { kind: "flyTo"; destinationId: string }
  | { kind: "highlight"; destinationIds: string[] }
  | { kind: "aurora"; active: boolean }
  | { kind: "chapter"; chapterId: ChapterId };

export interface Citation {
  id: string;
  title: string;
}

/** NDJSON events streamed from /api/copilot. */
export type CopilotEvent =
  | { type: "meta"; engine: string; experts: string[] }
  | { type: "delta"; text: string }
  | { type: "actions"; actions: GlobeAction[] }
  | { type: "citations"; citations: Citation[] }
  | { type: "error"; message: string }
  | { type: "done" };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
