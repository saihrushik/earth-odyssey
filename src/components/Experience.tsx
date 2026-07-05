import { education, experience } from "@/lib/data";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function Experience() {
  return (
    <section id="experience" className="pop-section mx-auto max-w-5xl scroll-mt-20 px-6 py-24">
      <SectionHeading index="04 — Path" title="Experience & education" />

      <div className="grid gap-12 md:grid-cols-2">
        {/* Experience */}
        <div>
          <h3 className="mb-6 font-mono text-sm text-red-bright">Experience</h3>
          <ol className="relative border-l border-border pl-6">
            {experience.map((job, i) => (
              <Reveal key={job.company} delay={i * 80}>
                <li className="relative mb-8 last:mb-0">
                  <span className="absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full bg-red box-glow" />
                  <p className="font-mono text-xs text-muted-2">{job.period}</p>
                  <h4 className="mt-1 font-semibold text-foreground">
                    {job.role}
                  </h4>
                  <p className="text-sm text-red-bright">{job.company}</p>
                  <ul className="mt-3 space-y-2">
                    {job.points.map((pt) => (
                      <li
                        key={pt}
                        className="flex gap-2 text-sm leading-relaxed text-muted"
                      >
                        <span className="text-red">▹</span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>

        {/* Education */}
        <div>
          <h3 className="mb-6 font-mono text-sm text-red-bright">Education</h3>
          <ol className="relative border-l border-border pl-6">
            {education.map((edu, i) => (
              <Reveal key={edu.school} delay={i * 80}>
                <li className="relative mb-8 last:mb-0">
                  <span className="absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full bg-red box-glow" />
                  <p className="font-mono text-xs text-muted-2">{edu.period}</p>
                  <h4 className="mt-1 font-semibold text-foreground">
                    {edu.school}
                  </h4>
                  <p className="text-sm text-red-bright">{edu.degree}</p>
                  <p className="mt-1 text-sm text-muted">{edu.detail}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
