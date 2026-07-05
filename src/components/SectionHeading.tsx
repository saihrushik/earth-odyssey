import Reveal from "./Reveal";

type Props = {
  /** Monospace kicker, e.g. "01 — About". */
  index: string;
  title: string;
};

export default function SectionHeading({ index, title }: Props) {
  return (
    <Reveal>
      <div className="mb-12">
        <span className="font-mono text-sm text-red-bright">{index}</span>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h2>
        <div className="mt-4 h-px w-24 bg-gradient-to-r from-red to-transparent box-glow-soft" />
      </div>
    </Reveal>
  );
}
