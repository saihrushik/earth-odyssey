import { runCopilot } from "@/server/copilot/engine";
import type { ChatMessage } from "@/server/copilot/protocol";

export const runtime = "nodejs";

/** Streams NDJSON CopilotEvents; the client applies globe actions as they arrive. */
export async function POST(request: Request) {
  let messages: ChatMessage[];
  try {
    const body = (await request.json()) as { messages?: ChatMessage[] };
    messages = (body.messages ?? []).filter(
      (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    );
    if (messages.length === 0) throw new Error("empty");
  } catch {
    return Response.json({ error: "Body must be { messages: [{ role, content }] }" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of runCopilot(messages)) {
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
