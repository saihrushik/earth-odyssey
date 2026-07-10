"use client";

import { useCallback, useRef, useState } from "react";
import { useOdyssey } from "../store/useOdyssey";

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
  citations?: { id: string; title: string }[];
  engine?: string;
}

/**
 * Streams NDJSON events from /api/copilot. Text deltas build the reply;
 * `actions` events are applied to the globe store the moment they arrive.
 */
export function useCopilot() {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Conversation history for the API — kept in a ref so `send` never races
  // React's deferred state updates.
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  const send = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    historyRef.current = [...historyRef.current, { role: "user", content: trimmed }];
    const history = historyRef.current;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }, { role: "assistant", content: "" }]);
    setBusy(true);

    const patchAssistant = (patch: (m: CopilotMessage) => CopilotMessage) =>
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") next[next.length - 1] = patch(last);
        return next;
      });

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history,
          context: { focusedDestinationId: useOdyssey.getState().focusedDestinationId ?? undefined },
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Copilot unavailable (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }
          switch (event.type) {
            case "delta":
              assistantText += event.text as string;
              patchAssistant((m) => ({ ...m, content: m.content + (event.text as string) }));
              break;
            case "actions":
              useOdyssey.getState().applyCopilotActions(event.actions as never);
              break;
            case "citations":
              patchAssistant((m) => ({ ...m, citations: event.citations as CopilotMessage["citations"] }));
              break;
            case "meta":
              patchAssistant((m) => ({ ...m, engine: event.engine as string }));
              break;
            case "error":
              patchAssistant((m) => ({ ...m, content: m.content || `⚠ ${event.message as string}` }));
              break;
          }
        }
      }
      if (assistantText) {
        historyRef.current = [...historyRef.current, { role: "assistant", content: assistantText }];
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        patchAssistant((m) => ({
          ...m,
          content: m.content || "⚠ I couldn't reach mission control. Try again in a moment.",
        }));
      }
    } finally {
      setBusy(false);
    }
  }, []);

  return { messages, busy, send };
}
