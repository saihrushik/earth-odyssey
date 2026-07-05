import { about } from "@/lib/data";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function About() {
  return (
    <section id="about" className="pop-section mx-auto max-w-5xl scroll-mt-20 px-6 py-24">
      <SectionHeading index="01 — About" title="Who I am" />

      <div className="grid gap-10 md:grid-cols-5">
        <div className="space-y-5 text-muted leading-relaxed md:col-span-3">
          {about.paragraphs.map((p, i) => (
            <Reveal key={i} delay={i * 80}>
              <p>{p}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120} className="md:col-span-2">
          <div className="card p-6">
            <h3 className="mb-4 font-mono text-sm text-red-bright">
              What I focus on
            </h3>
            <ul className="space-y-3">
              {about.highlights.map((h) => (
                <li key={h} className="flex items-start gap-3 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red box-glow-soft" />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
