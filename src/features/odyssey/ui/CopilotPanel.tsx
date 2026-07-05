"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCopilot } from "../hooks/useCopilot";
import { useOdyssey } from "../store/useOdyssey";

const SUGGESTIONS = [
  "I have $2500 and 10 days — where should I go?",
  "Show me the Northern Lights",
  "I love hiking but hate crowds",
  "Find places similar to Switzerland",
  "Romantic honeymoon ideas",
  "Where can I visit anime locations?",
];

/** Minimal markdown: **bold** plus paragraph breaks. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="mb-2 last:mb-0">
          {para.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j} className="font-medium text-cyan-100">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <span key={j}>{part}</span>
            ),
          )}
        </p>
      ))}
    </>
  );
}

export function CopilotPanel() {
  const open = useOdyssey((s) => s.copilotOpen);
  const setOpen = useOdyssey((s) => s.setCopilotOpen);
  const { messages, busy, send } = useCopilot();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = () => {
    if (busy) return;
    send(input);
    setInput("");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 26 } }}
          exit={{ opacity: 0, y: 30, scale: 0.96, transition: { duration: 0.25 } }}
          className="ody-glass absolute bottom-24 left-4 z-30 flex h-[min(560px,70vh)] w-[min(400px,92vw)] flex-col overflow-hidden rounded-3xl"
          aria-label="AI Travel Copilot"
          style={{ boxShadow: "0 0 60px -12px rgba(56, 189, 248, 0.25), 0 24px 80px -24px rgba(0,0,0,0.8)" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
            <div className="relative">
              <div
                className="grid h-9 w-9 place-items-center rounded-full text-base"
                style={{ background: "radial-gradient(circle at 35% 30%, rgba(94,234,212,0.35), rgba(30,64,175,0.4))" }}
              >
                ✦
              </div>
              <span
                className="absolute inset-0 rounded-full border border-cyan-300/40"
                style={{ animation: "ody-pulse 2.6s ease-in-out infinite" }}
              />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-white">Travel Copilot</div>
              <div className="text-[10px] tracking-[0.2em] text-cyan-200/50 uppercase">
                {busy ? "navigating…" : "RAG + live tools · controls the globe"}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close copilot"
              className="grid h-8 w-8 place-items-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="ody-scroll flex-1 overflow-y-auto px-5 py-4">
            {messages.length === 0 && (
              <div>
                <p className="mb-4 text-[13px] leading-relaxed text-sky-100/60">
                  Tell me how you travel — budget, cravings, vibes — and I&apos;ll spin the globe to
                  the right places.
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-2xl border border-white/8 bg-white/4 px-4 py-2.5 text-left text-[12.5px] text-sky-100/75 transition-all hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-cyan-400/15 text-cyan-50"
                      : "border border-white/8 bg-white/4 text-sky-50/90"
                  }`}
                >
                  {m.role === "assistant" && m.content === "" && busy ? (
                    <span className="inline-flex gap-1.5 py-1">
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="h-1.5 w-1.5 rounded-full bg-cyan-300/80"
                          style={{ animation: `ody-pulse 1.1s ease-in-out ${d * 0.18}s infinite` }}
                        />
                      ))}
                    </span>
                  ) : (
                    <RichText text={m.content} />
                  )}
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-2 border-t border-white/8 pt-2">
                      <span className="text-[9.5px] tracking-[0.2em] text-sky-200/40 uppercase">Sources</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.citations.map((c) => (
                          <span key={c.id} className="ody-chip !text-[10px]">
                            {c.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-center gap-2 border-t border-white/8 p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about anywhere on Earth…"
              aria-label="Message the travel copilot"
              className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-[13px] text-white placeholder-sky-200/30 outline-none transition-colors focus:border-cyan-300/40"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan-400/20 text-cyan-100 transition-all hover:bg-cyan-400/35 disabled:opacity-40"
            >
              {busy ? (
                <span
                  className="h-4 w-4 rounded-full border-2 border-cyan-200/30 border-t-cyan-200"
                  style={{ animation: "ody-spin 0.8s linear infinite" }}
                />
              ) : (
                "➤"
              )}
            </button>
          </form>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
