"use client";
import { focusRing } from "@/components/dashboard/overview-kit";
import { cn } from "@/lib/utils";

/** Filter by milestone: All, then one chip per milestone that has something to show. */
export function MilestoneChips({ options, value, onChange }: {
    options: { key: string; label: string }[];
    value: string | null;
    onChange: (key: string | null) => void;
}) {
    const chip = (active: boolean) => cn("press inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors duration-300 ease-spring", active ? "bg-ink text-white" : "bg-surface text-ink-secondary shadow-card hover:text-ink", focusRing);
    return (<div role="group" aria-label="Filter by milestone" className="materialize flex flex-wrap gap-2">
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>All</button>
      {options.map((o) => <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(value === o.key ? null : o.key)} className={chip(value === o.key)}>{o.label}</button>)}
    </div>);
}
