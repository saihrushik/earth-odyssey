import { runLlmCopilot } from "./llm";
import { runOfflineCopilot, type CopilotContext } from "./offline";
import type { ChatMessage, CopilotEvent } from "./protocol";

/**
 * Copilot entry point. Uses the OpenAI-powered agent when a key is configured,
 * otherwise the deterministic offline engine — both speak the same event
 * protocol and drive the globe identically.
 */
export function runCopilot(messages: ChatMessage[], context: CopilotContext = {}): AsyncGenerator<CopilotEvent> {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? runLlmCopilot(messages, apiKey, context) : runOfflineCopilot(messages, context);
}

export type { CopilotContext };
