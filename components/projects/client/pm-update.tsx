import { agoPhrase, isoDateIn } from "@/lib/dashboard";
import { HEALTH, type StatusUpdate } from "@/lib/project-log";
import { cn } from "@/lib/utils";

const TONE = { on_track: "bg-success-soft text-success", at_risk: "bg-warning-soft text-warning", off_track: "bg-danger-soft text-danger" } as const;

/** The project manager's latest word on the project, in their own words. */
export function PmUpdate({ update, pm, today }: {
    update: StatusUpdate;
    pm: string;
    today: string;
}) {
    return (<section aria-label="Update from your project manager" className="materialize rounded-[20px] material p-5">
      <p className="flex items-center gap-2 text-xs text-ink-tertiary">
        <span className={cn("rounded-full px-2 py-0.5 font-semibold", TONE[update.health])}>{HEALTH[update.health].label}</span>
        {pm} · {agoPhrase(isoDateIn(update.at), today)}
      </p>
      <p className="mt-2.5 text-[15px] leading-relaxed text-pretty whitespace-pre-wrap text-ink">{update.note}</p>
    </section>);
}
