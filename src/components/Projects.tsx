import { projects } from "@/lib/data";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";
import Tilt from "./Tilt";

export default function Projects() {
  return (
    <section id="projects" className="pop-section mx-auto max-w-5xl scroll-mt-20 px-6 py-24">
      <SectionHeading index="03 — Projects" title="Things I've built" />

      <div className="grid gap-6 md:grid-cols-2">
        {projects.map((project, i) => {
          const hasLinks = project.github || project.demo;
          return (
            <Reveal key={project.title} delay={i * 80}>
              <Tilt>
                <article
                  data-batman-jump
                  className="card group flex h-full cursor-pointer flex-col p-7"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <h3 className="text-xl font-semibold leading-snug text-foreground transition-colors group-hover:text-red-bright">
                      {project.title}
                    </h3>
                    <span className="font-mono text-xs text-muted-2">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <p className="flex-1 text-sm leading-relaxed text-muted">
                    {project.blurb}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {project.tech.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>

                  {hasLinks && (
                    <div className="mt-6 flex gap-4 text-sm">
                      {project.github && (
                        <a
                          href={project.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted transition-colors hover:text-red-bright"
                        >
                          Code ↗
                        </a>
                      )}
                      {project.demo && (
                        <a
                          href={project.demo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted transition-colors hover:text-red-bright"
                        >
                          Live demo ↗
                        </a>
                      )}
                    </div>
                  )}
                </article>
              </Tilt>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
