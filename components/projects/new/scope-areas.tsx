"use client";
import { Plus, X } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import { emptyArea, WORK_TYPES, type ScopeArea } from "@/lib/project-intake";
import { cn } from "@/lib/utils";

export const LINE = "w-full border-0 border-b border-dashed border-ink-tertiary/50 bg-transparent px-0.5 pb-1 text-[15px] text-ink outline-none placeholder:text-ink-tertiary/70 focus:border-solid focus:border-copper print:placeholder:text-transparent";

/**
 * The scope of work, area by area, as it would be written on paper: the
 * area's name, the kinds of work ticked, its size and notes. Gemini plans
 * from exactly this.
 */
export function ScopeAreas({ value, onChange, highlighted }: {
    value: ScopeArea[];
    onChange: (areas: ScopeArea[]) => void;
    highlighted?: boolean;
}) {
    const patch = (i: number, p: Partial<ScopeArea>) => onChange(value.map((a, n) => (n === i ? { ...a, ...p } : a)));
    return (<div className={cn("grid gap-3", highlighted && "rounded-lg bg-brand-soft/60 ring-4 ring-brand-soft/60 print:bg-transparent print:ring-0")}>
      {value.map((area, i) => (<fieldset key={i} className="break-inside-avoid rounded-xl border border-line p-3.5 sm:p-4 print:rounded-none">
          <legend className="sr-only">Area {i + 1}</legend>
          <div className="flex items-end gap-3">
            <label className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold tracking-[0.08em] text-ink-tertiary uppercase">Area {i + 1}</span>
              <input value={area.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="e.g. Kitchen" maxLength={80} className={cn(LINE, "mt-1 font-medium")}/>
            </label>
            <label className="w-24 shrink-0">
              <span className="text-[11px] font-semibold tracking-[0.08em] text-ink-tertiary uppercase">Size, sqm</span>
              <input type="number" inputMode="decimal" min={0} step="any" value={area.sqm ?? ""} onChange={(e) => patch(i, { sqm: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} placeholder="—" className={cn(LINE, "mt-1 tabular")}/>
            </label>
            {value.length > 1 ? (<button type="button" onClick={() => onChange(value.filter((_, n) => n !== i))} aria-label={`Remove ${area.name || `area ${i + 1}`}`} data-print-hide className={cn("press grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-ink-tertiary hover:bg-surface-sunken hover:text-ink", focusRing)}>
                <X className="size-4" aria-hidden/>
              </button>) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={`Work in ${area.name || `area ${i + 1}`}`}>
            {WORK_TYPES.map((w) => {
                const on = area.work.includes(w);
                return (<button key={w} type="button" aria-pressed={on} onClick={() => patch(i, { work: on ? area.work.filter((x) => x !== w) : [...area.work, w] })} className={cn("press inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors duration-200 print:h-auto print:py-0.5", on ? "border-copper/45 bg-brand-soft text-brand" : "border-line-strong bg-surface text-ink-secondary hover:border-copper hover:text-brand", focusRing)}>
                  <span className={cn("size-3 rounded-[3px] border", on ? "border-copper bg-copper" : "border-ink-tertiary/60")} aria-hidden/>{w}
                </button>);
            })}
          </div>
          <label className="mt-3 block">
            <span className="sr-only">Notes for {area.name || `area ${i + 1}`}</span>
            <input value={area.notes} onChange={(e) => patch(i, { notes: e.target.value })} placeholder="Notes: finishes, what the client asked for" maxLength={600} className={cn(LINE, "text-[14px]")}/>
          </label>
        </fieldset>))}
      {value.length < 30 ? (<button type="button" onClick={() => onChange([...value, emptyArea()])} data-print-hide className={cn("press inline-flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3.5 text-[13px] font-medium text-ink-secondary hover:border-copper hover:text-brand", focusRing)}>
          <Plus className="size-4" aria-hidden/>Add area
        </button>) : null}
    </div>);
}
