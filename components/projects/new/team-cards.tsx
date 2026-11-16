"use client";
import { Check } from "lucide-react";
import { Face, focusRing } from "@/components/dashboard/overview-kit";
import type { CrewRole } from "@/lib/auto-plan";
import { cn } from "@/lib/utils";
import { CLASSIFICATION_TERMS } from "@/lib/vocabulary";

export type CrewOption = { id: string; name: string; avatarUrl: string | null; role: CrewRole | null; context: string };

const GROUPS: (CrewRole | null)[] = ["site_manager", "foreman", "safety_officer", null];

/**
 * The team, picked by tapping people grouped by what they do on site. The
 * plan gives each task to someone with the right role, so the groups show
 * who covers what.
 */
export function TeamCards({ crew, value, onChange, highlighted }: {
    crew: CrewOption[];
    value: string[];
    onChange: (ids: string[]) => void;
    highlighted?: boolean;
}) {
    const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
    if (crew.length === 0)
        return <p className="text-[13px] text-ink-tertiary">No crew accounts yet. The administrator adds them under People.</p>;
    return (<div className={cn("grid gap-4", highlighted && "rounded-lg bg-brand-soft/60 ring-4 ring-brand-soft/60 print:bg-transparent print:ring-0")}>
      {GROUPS.map((role) => {
            const people = crew.filter((p) => p.role === role);
            if (people.length === 0)
                return null;
            return (<div key={role ?? "other"} role="group" aria-label={role ? CLASSIFICATION_TERMS[role] : "Other crew"}>
            <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-ink-tertiary uppercase">{role ? CLASSIFICATION_TERMS[role] : "Other crew"}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {people.map((p) => {
                    const on = value.includes(p.id);
                    return (<li key={p.id}>
                  <button type="button" aria-pressed={on} onClick={() => toggle(p.id)} className={cn("press flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200", on ? "border-copper bg-brand-soft" : "border-line bg-surface hover:border-line-strong", focusRing)}>
                    <Face person={{ id: p.id, name: p.name, avatarUrl: p.avatarUrl, role: "" }} size={32}/>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{p.name}</span>
                      <span className="block truncate text-xs text-ink-tertiary">{p.context}</span>
                    </span>
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border transition-colors", on ? "border-copper bg-copper text-white" : "border-line-strong")} aria-hidden>
                      {on ? <Check className="size-3"/> : null}
                    </span>
                  </button>
                </li>);
                })}
            </ul>
          </div>);
        })}
      {value.length > 0 ? <p className="text-[12.5px] text-ink-secondary" aria-live="polite">{value.length === 1 ? "1 person" : `${value.length} people`} on the team. Each gets an invitation.</p> : null}
    </div>);
}
