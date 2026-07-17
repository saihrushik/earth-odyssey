"use client";

import { useRef, useState } from "react";
import { useOdyssey, type CustomPin } from "../store/useOdyssey";

interface Candidate extends CustomPin {
  region?: string;
}

/** Search any place on Earth — flies the globe there and drops a gold pin. */
export function SearchBar() {
  const setCustomPin = useOdyssey((s) => s.setCustomPin);
  const [value, setValue] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [status, setStatus] = useState<"idle" | "busy" | "none">("idle");
  const seq = useRef(0);

  const pick = (c: Candidate) => {
    setCustomPin(c);
    setValue("");
    setCandidates([]);
    setStatus("idle");
  };

  const search = async () => {
    const q = value.trim();
    if (!q) return;
    const mySeq = ++seq.current;
    setStatus("busy");
    try {
      const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { results: Candidate[] };
      if (mySeq !== seq.current) return;
      if (json.results.length === 0) {
        setStatus("none");
        setCandidates([]);
      } else if (json.results.length === 1) {
        pick(json.results[0]);
      } else {
        setStatus("idle");
        setCandidates(json.results);
      }
    } catch {
      if (mySeq === seq.current) setStatus("none");
    }
  };

  return (
    <div className="pointer-events-auto relative w-56 sm:w-72">
      <div className="ody-glass flex items-center gap-2 rounded-full px-3 py-1.5">
        <span className="text-[13px] text-sky-200/60">🔍</span>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus("idle");
            setCandidates([]);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void search();
            if (e.key === "Escape") {
              setCandidates([]);
              (e.target as HTMLElement).blur();
            }
          }}
          placeholder="Search any place on Earth…"
          aria-label="Search any place on Earth"
          className="w-full bg-transparent text-[13px] text-sky-50 placeholder:text-sky-200/40 focus:outline-none"
        />
        {status === "busy" && (
          <span
            className="h-3 w-3 shrink-0 rounded-full border border-sky-300/60 border-t-transparent"
            style={{ animation: "ody-spin 0.8s linear infinite" }}
          />
        )}
      </div>

      {status === "none" && (
        <div className="ody-glass absolute top-full mt-2 w-full rounded-xl px-3 py-2 text-[12px] text-sky-200/70">
          No place found — try a city or landmark name.
        </div>
      )}

      {candidates.length > 0 && (
        <div className="ody-glass absolute top-full mt-2 w-full overflow-hidden rounded-xl">
          {candidates.map((c, i) => (
            <button
              key={`${c.name}-${i}`}
              onClick={() => pick(c)}
              className="block w-full px-3 py-2 text-left text-[13px] text-sky-50 transition hover:bg-sky-300/10"
            >
              {c.name}
              <span className="ml-1.5 text-[11px] text-sky-200/50">
                {[c.region, c.country].filter(Boolean).join(", ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
