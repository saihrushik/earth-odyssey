import { profile, socials } from "@/lib/data";
import Reveal from "./Reveal";

export default function Contact() {
  return (
    <section id="contact" className="pop-section mx-auto max-w-5xl scroll-mt-20 px-6 py-28">
      <Reveal>
        <div className="card relative overflow-hidden p-10 text-center sm:p-16">
          {/* Bat-signal glow */}
          <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red/20 blur-3xl" />

          <span className="font-mono text-sm text-red-bright">05 — Contact</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Let&apos;s build something
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            I&apos;m actively looking for AI/ML and software engineering roles, and
            always happy to talk shop. Drop me a line — I reply fast.
          </p>

          <a
            href={`mailto:${socials.email}`}
            className="mt-8 inline-block rounded-lg bg-red px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-red-bright hover:box-glow"
          >
            {socials.email}
          </a>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted">
            <a
              href={socials.github}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-red-bright"
            >
              GitHub
            </a>
            <a
              href={socials.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-red-bright"
            >
              LinkedIn
            </a>
            <a
              href={socials.resume}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-red-bright"
            >
              Résumé
            </a>
          </div>

          <p className="mt-8 text-xs text-muted-2">
            Based in {profile.location}
          </p>
        </div>
      </Reveal>
    </section>
  );
}
