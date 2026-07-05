"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useOdyssey } from "../store/useOdyssey";

export function IntroOverlay() {
  const started = useOdyssey((s) => s.started);
  const begin = useOdyssey((s) => s.begin);

  return (
    <AnimatePresence>
      {!started && (
        <motion.div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center"
          style={{ background: "radial-gradient(ellipse at 50% 60%, rgba(4,8,18,0.25), rgba(2,4,10,0.88))" }}
          exit={{ opacity: 0, transition: { duration: 1.4, ease: "easeInOut" } }}
        >
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.4, duration: 1 } }}
            className="mb-4 text-[11px] tracking-[0.5em] text-sky-200/60 uppercase"
          >
            A living digital Earth
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16, letterSpacing: "0.4em" }}
            animate={{ opacity: 1, y: 0, letterSpacing: "0.18em", transition: { delay: 0.7, duration: 1.4, ease: "easeOut" } }}
            className="px-4 text-[clamp(2.2rem,7.5vw,4.5rem)] font-light text-white"
          >
            EARTH&nbsp;ODYSSEY
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 1.4, duration: 1 } }}
            className="mt-5 max-w-md px-6 text-sm leading-relaxed text-sky-100/55"
          >
            Orbit the planet, chase auroras, and let an AI travel copilot fly you to your next
            destination.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 1.9, duration: 0.8 } }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={begin}
            className="ody-glass mt-10 rounded-full px-9 py-3.5 text-sm tracking-[0.25em] text-sky-50 uppercase transition-colors hover:border-sky-300/40"
          >
            Begin journey
          </motion.button>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 2.6, duration: 1 } }}
            className="absolute bottom-8 flex gap-6 text-[11px] tracking-widest text-sky-200/40 uppercase"
          >
            <span>Drag — orbit</span>
            <span>Scroll — travel</span>
            <span>Pinch — zoom</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
