import { destinationById } from "@/features/odyssey/data/destinations";
import { retrieve } from "../rag/retriever";
import { getCurrentWeather, getForecast } from "../tools/weather";
import { convertCurrency } from "../tools/currency";
import { distanceBetween } from "../tools/geoTools";
import { getFlightQuote, findOriginHub } from "../tools/flights";
import { getStays } from "../tools/hotels";
import { destinationById as destById } from "@/features/odyssey/data/destinations";
import type { CopilotContext } from "./offline";
import { analyzeIntents, selectExperts } from "../agents/supervisor";
import { buildSystemPrompt } from "../prompts/system";
import type { ChatMessage, Citation, CopilotEvent, GlobeAction } from "./protocol";

/**
 * LLM copilot engine — OpenAI chat completions with streaming + tool calling,
 * spoken over plain fetch/SSE so there is no SDK version drift.
 */

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_knowledge",
      description: "Semantic search over the Earth Odyssey travel knowledge base (RAG). Use before making factual claims.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Live current weather at a catalog destination.",
      parameters: {
        type: "object",
        properties: { destinationId: { type: "string" } },
        required: ["destinationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "convert_currency",
      description: "Convert an amount between ISO currency codes at live rates.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number" },
          from: { type: "string" },
          to: { type: "string" },
        },
        required: ["amount", "from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "distance_between",
      description: "Great-circle distance in km between two catalog destination ids.",
      parameters: {
        type: "object",
        properties: { a: { type: "string" }, b: { type: "string" } },
        required: ["a", "b"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_flights",
      description: "Round-trip flight price for a destination. Live Amadeus quote when configured, transparent estimate otherwise (result says which).",
      parameters: {
        type: "object",
        properties: {
          destinationId: { type: "string" },
          originCity: { type: "string", description: "Departure city, e.g. 'New York'" },
          departDate: { type: "string", description: "YYYY-MM-DD" },
          returnDate: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["destinationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stays",
      description: "Curated stay recommendations (budget/mid/luxury) with nightly rates for a destination.",
      parameters: {
        type: "object",
        properties: { destinationId: { type: "string" } },
        required: ["destinationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_forecast",
      description: "Daily weather forecast for a destination and date range (horizon 16 days). Returns null past the horizon — then reason from the best season instead.",
      parameters: {
        type: "object",
        properties: {
          destinationId: { type: "string" },
          startDate: { type: "string", description: "YYYY-MM-DD" },
          endDate: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["destinationId", "startDate", "endDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "control_globe",
      description: "Drive the 3D globe: highlight recommended destinations, fly to the top pick, toggle aurora.",
      parameters: {
        type: "object",
        properties: {
          highlight: { type: "array", items: { type: "string" }, description: "Destination ids to make glow" },
          flyTo: { type: "string", description: "Destination id to fly the camera to" },
          aurora: { type: "boolean" },
        },
      },
    },
  },
] as const;

interface ToolCall {
  id: string;
  name: string;
  args: string;
}

interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

async function executeTool(
  call: ToolCall,
  citations: Citation[],
): Promise<{ result: string; actions?: GlobeAction[] }> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.args || "{}");
  } catch {
    return { result: "Invalid tool arguments." };
  }

  try {
    switch (call.name) {
      case "search_knowledge": {
        const { docs } = await retrieve(String(args.query ?? ""), 5);
        for (const d of docs.slice(0, 4)) {
          if (!citations.some((c) => c.id === d.doc.id)) citations.push({ id: d.doc.id, title: d.doc.title });
        }
        return {
          result: JSON.stringify(docs.map((d) => ({ id: d.doc.id, title: d.doc.title, text: d.doc.text }))),
        };
      }
      case "get_weather": {
        const dest = destinationById(String(args.destinationId ?? ""));
        if (!dest) return { result: "Unknown destination id." };
        const w = await getCurrentWeather(dest.lat, dest.lng);
        return { result: JSON.stringify(w) };
      }
      case "convert_currency":
        return {
          result: JSON.stringify(await convertCurrency(Number(args.amount), String(args.from), String(args.to))),
        };
      case "get_flights": {
        const origin = args.originCity ? findOriginHub(`from ${String(args.originCity)}`) : null;
        const quote = await getFlightQuote(
          String(args.destinationId ?? ""),
          origin,
          args.departDate ? String(args.departDate) : undefined,
          args.returnDate ? String(args.returnDate) : undefined,
        );
        return { result: quote ? JSON.stringify(quote) : "Unknown destination id." };
      }
      case "get_stays":
        return { result: JSON.stringify(await getStays(String(args.destinationId ?? ""))) };
      case "get_forecast": {
        const dest = destById(String(args.destinationId ?? ""));
        if (!dest) return { result: "Unknown destination id." };
        const fc = await getForecast(dest.lat, dest.lng, String(args.startDate ?? ""), String(args.endDate ?? ""));
        return { result: fc ? JSON.stringify(fc) : "Dates beyond the 16-day forecast horizon — use the destination's best season." };
      }
      case "distance_between": {
        const km = distanceBetween(String(args.a ?? ""), String(args.b ?? ""));
        return { result: km === null ? "Unknown destination id." : `${km} km` };
      }
      case "control_globe": {
        const actions: GlobeAction[] = [];
        if (Array.isArray(args.highlight) && args.highlight.length) {
          actions.push({ kind: "highlight", destinationIds: args.highlight.map(String) });
        }
        if (typeof args.flyTo === "string" && destinationById(args.flyTo)) {
          actions.push({ kind: "flyTo", destinationId: args.flyTo });
        }
        if (typeof args.aurora === "boolean") actions.push({ kind: "aurora", active: args.aurora });
        return { result: "Globe updated.", actions };
      }
      default:
        return { result: `Unknown tool ${call.name}` };
    }
  } catch (err) {
    return { result: `Tool failed: ${err instanceof Error ? err.message : "unknown error"}` };
  }
}

export async function* runLlmCopilot(
  messages: ChatMessage[],
  apiKey: string,
  context: CopilotContext = {},
): AsyncGenerator<CopilotEvent> {
  const query = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const experts = selectExperts(analyzeIntents(query));
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1";

  yield { type: "meta", engine: `openai/${model}`, experts };

  const citations: Citation[] = [];
  const focusNote = context.focusedDestinationId
    ? `\n\nThe user is currently looking at "${context.focusedDestinationId}" on the globe — unqualified questions ("best time to visit?", "how much are tickets?") refer to it.`
    : "";
  const convo: OpenAIMessage[] = [
    { role: "system", content: buildSystemPrompt(experts) + focusNote },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  for (let round = 0; round < 5; round++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: convo, tools: TOOLS, stream: true, temperature: 0.7 }),
    });
    if (!res.ok || !res.body) {
      yield { type: "error", message: `OpenAI request failed (${res.status}).` };
      return;
    }

    const toolCalls = new Map<number, ToolCall>();
    let assistantText = "";
    let finish: string | null = null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.replace(/^data: ?/, "").trim();
        if (!data || data === "[DONE]" || !line.startsWith("data:")) continue;
        let parsed: {
          choices?: {
            delta?: { content?: string; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] };
            finish_reason?: string | null;
          }[];
        };
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        const choice = parsed.choices?.[0];
        if (!choice) continue;
        if (choice.delta?.content) {
          assistantText += choice.delta.content;
          yield { type: "delta", text: choice.delta.content };
        }
        for (const tc of choice.delta?.tool_calls ?? []) {
          const existing = toolCalls.get(tc.index) ?? { id: "", name: "", args: "" };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name += tc.function.name;
          if (tc.function?.arguments) existing.args += tc.function.arguments;
          toolCalls.set(tc.index, existing);
        }
        if (choice.finish_reason) finish = choice.finish_reason;
      }
    }

    if (finish === "tool_calls" && toolCalls.size > 0) {
      const calls = [...toolCalls.values()];
      convo.push({
        role: "assistant",
        content: assistantText || null,
        tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args } })),
      });
      for (const call of calls) {
        const { result, actions } = await executeTool(call, citations);
        if (actions?.length) yield { type: "actions", actions };
        convo.push({ role: "tool", content: result, tool_call_id: call.id });
      }
      continue; // next round with tool results in context
    }

    break; // normal completion
  }

  if (citations.length) yield { type: "citations", citations };
  yield { type: "done" };
}
