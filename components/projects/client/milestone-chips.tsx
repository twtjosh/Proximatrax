"use client";
import { ChevronDown } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import { cn } from "@/lib/utils";

/**
 * Filter by milestone: All, then one chip per milestone that has something to
 * show. On a phone the chips would stack into rows of buttons, so it is one
 * native picker there instead, which opens the phone's own wheel or sheet.
 */
export function MilestoneChips({ options, value, onChange }: {
    options: { key: string; label: string }[];
    value: string | null;
    onChange: (key: string | null) => void;
}) {
    const chip = (active: boolean) => cn("press inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors duration-300 ease-spring", active ? "bg-ink text-white" : "bg-surface text-ink-secondary shadow-card hover:text-ink", focusRing);
    return (<>
      <label className="materialize relative block w-full sm:hidden">
        <span className="sr-only">Filter by milestone</span>
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={cn("h-11 w-full cursor-pointer appearance-none truncate rounded-full bg-surface pr-10 pl-4 text-[15px] font-medium text-ink shadow-card", focusRing)}>
          <option value="">All milestones</option>
          {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-tertiary" aria-hidden/>
      </label>
      <div role="group" aria-label="Filter by milestone" className="materialize flex flex-wrap gap-2 max-sm:hidden">
        <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>All</button>
        {options.map((o) => <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(value === o.key ? null : o.key)} className={chip(value === o.key)}>{o.label}</button>)}
      </div>
    </>);
}
