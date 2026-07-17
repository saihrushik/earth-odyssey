import { claudeAvailable, runClaudeCopilot } from "./claude";
import { runLlmCopilot } from "./llm";
import { runOfflineCopilot, type CopilotContext } from "./offline";
import type { ChatMessage, CopilotEvent } from "./protocol";

/**
 * Copilot entry point. Engine priority: Claude (ANTHROPIC_API_KEY) →
 * OpenAI (OPENAI_API_KEY) → deterministic offline engine. All three speak
 * the same event protocol and drive the globe identically.
 */
export function runCopilot(messages: ChatMessage[], context: CopilotContext = {}): AsyncGenerator<CopilotEvent> {
  if (claudeAvailable()) return runClaudeCopilot(messages, context);
  const openaiKey = process.env.OPENAI_API_KEY;
  return openaiKey ? runLlmCopilot(messages, openaiKey, context) : runOfflineCopilot(messages, context);
}

export type { CopilotContext };
