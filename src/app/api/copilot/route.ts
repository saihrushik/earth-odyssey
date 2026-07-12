import { runCopilot, type CopilotContext } from "@/server/copilot/engine";
import type { ChatMessage } from "@/server/copilot/protocol";

export const runtime = "nodejs";

/** Streams NDJSON CopilotEvents; the client applies globe actions as they arrive. */
export async function POST(request: Request) {
  let messages: ChatMessage[];
  let context: CopilotContext = {};
  try {
    const body = (await request.json()) as { messages?: ChatMessage[]; context?: CopilotContext };
    messages = (body.messages ?? []).filter(
      (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    );
    if (typeof body.context?.focusedDestinationId === "string") {
      context = { focusedDestinationId: body.context.focusedDestinationId };
    }
    if (messages.length === 0) throw new Error("empty");
  } catch {
    return Response.json({ error: "Body must be { messages: [{ role, content }] }" }, { status: 400 });
  }

  // When a Python RAG backend is configured (backend/ — FastAPI + ChromaDB +
  // Ollama), proxy the stream through. Falls back to the built-in TS engine
  // if the backend is down, so the copilot never goes dark.
  const backendUrl = process.env.COPILOT_BACKEND_URL;
  if (backendUrl) {
    try {
      const upstream = await fetch(`${backendUrl.replace(/\/$/, "")}/api/copilot`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages, context }),
        signal: AbortSignal.timeout(120_000),
      });
      if (upstream.ok && upstream.body) {
        return new Response(upstream.body, {
          headers: {
            "content-type": "application/x-ndjson; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      }
      console.warn(`[copilot] python backend responded ${upstream.status} — using built-in engine`);
    } catch (err) {
      console.warn(`[copilot] python backend unreachable — using built-in engine: ${err instanceof Error ? err.message : err}`);
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of runCopilot(messages, context)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Copilot failed.";
        controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message }) + "\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
