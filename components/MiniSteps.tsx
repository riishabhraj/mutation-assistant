import { STEPS, type StepKey } from "@/lib/types";

// Compact progress bar: done = filled, current = ring, upcoming = empty.
export function MiniSteps({ step, closed }: { step: StepKey; closed?: boolean }) {
  const idx = STEPS.indexOf(step);
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {STEPS.map((s, i) => (
        <span key={s} className={`h-2 w-8 rounded-full ${closed || i < idx ? "bg-brand" : i === idx ? "bg-brand/40 ring-2 ring-brand" : "bg-line"}`} />
      ))}
    </div>
  );
}
