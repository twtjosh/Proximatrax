"use client";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectOption = {
    id: string;
    title: string;
    client: string;
    /** "Jun 1 – Sep 25, 2026". */
    dates: string;
    accepted: number;
    total: number;
    status: { text: string; tone: "ok" | "late" | "done" };
};

const TONE = { ok: "bg-info-soft text-info", late: "bg-danger-soft text-danger", done: "bg-success-soft text-success" } as const;

/**
 * Which project the timeline shows: a labelled box with the name, client and
 * dates, opening a searchable list where each project carries its progress
 * and where it stands. Keyboard and screen-reader behaviour come from Base
 * UI's combobox.
 */
export function ProjectPicker({ projects, value, onChange }: { projects: ProjectOption[]; value: string; onChange: (id: string) => void }) {
    const selected = projects.find((p) => p.id === value) ?? null;
    return (<Combobox.Root items={projects} value={selected} onValueChange={(p) => p && onChange(p.id)} itemToStringLabel={(p: ProjectOption) => `${p.title} ${p.client}`} isItemEqualToValue={(a: ProjectOption, b: ProjectOption) => a.id === b.id}>
      <Combobox.Trigger aria-label={`Project: ${selected?.title ?? "none"}. Change project`} className="group flex max-w-full min-w-0 items-center gap-3.5 rounded-2xl bg-surface py-2.5 pr-3 pl-4 text-left shadow-[0_0_0_1px_var(--line-strong),0_1px_2px_rgb(14_18_34/0.05)] outline-none transition-[box-shadow,background-color] duration-200 hover:bg-surface-subtle hover:shadow-[0_0_0_1px_var(--ink-tertiary),0_10px_22px_-16px_rgb(14_18_34/0.4)] focus-visible:shadow-[0_0_0_2px_var(--copper),0_0_0_6px_var(--copper-soft)] data-popup-open:shadow-[0_0_0_2px_var(--copper),0_0_0_6px_var(--copper-soft)]">
        <span className="grid min-w-0">
          <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-tertiary uppercase">Project</span>
          <span className="truncate text-[1.3rem] leading-tight font-semibold tracking-[-0.025em] text-ink">{selected?.title ?? "Choose a project"}</span>
          {selected ? <span className="truncate text-[12.5px] text-ink-tertiary">{selected.client} · {selected.dates}</span> : null}
        </span>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-ink transition-[transform,background-color,color] duration-200 group-hover:bg-line group-data-popup-open:rotate-180 group-data-popup-open:bg-copper group-data-popup-open:text-white" aria-hidden>
          <ChevronDown className="size-4"/>
        </span>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={8} align="start" collisionPadding={12} className="z-50">
          <Combobox.Popup className="w-[min(27rem,calc(100vw-2rem))] origin-(--transform-origin) rounded-2xl bg-surface p-2 shadow-[0_0_0_1px_rgb(14_18_34/0.08),0_24px_48px_-20px_rgb(14_18_34/0.4)] transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <label className="flex h-10 items-center gap-2 rounded-[10px] bg-surface-subtle px-3 text-ink-tertiary shadow-[inset_0_0_0_1px_var(--line)] focus-within:shadow-[inset_0_0_0_1.5px_var(--copper)]">
              <Search className="size-4" aria-hidden/>
              <Combobox.Input placeholder="Search projects or clients" className="h-full w-full min-w-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-tertiary"/>
            </label>
            <Combobox.Empty className="px-3 py-5 text-center text-sm text-ink-tertiary empty:hidden">No project matches that name.</Combobox.Empty>
            <Combobox.List className="mt-2 grid max-h-80 gap-0.5 overflow-y-auto empty:mt-0">
              {(p: ProjectOption) => (<Combobox.Item key={p.id} value={p} className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_20px] items-center gap-x-3 gap-y-1.5 rounded-xl px-3 py-2.5 outline-none select-none data-highlighted:bg-surface-subtle data-selected:bg-brand-soft">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink group-data-selected:text-brand">{p.title}</span>
                    <span className="block truncate text-xs text-ink-tertiary">{p.client} · {p.dates}</span>
                  </span>
                  <span className="grid size-5 place-items-center rounded-full shadow-[inset_0_0_0_1.5px_var(--line-strong)]">
                    <Combobox.ItemIndicator className="grid size-5 place-items-center rounded-full bg-copper text-white"><Check className="size-3" strokeWidth={3} aria-hidden/></Combobox.ItemIndicator>
                  </span>
                  <span className="col-span-2 flex items-center gap-2.5 text-xs text-ink-secondary">
                    <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-surface-sunken"><span className="block h-full rounded-full bg-copper" style={{ width: `${p.total ? (p.accepted / p.total) * 100 : 0}%` }}/></span>
                    <span className="tabular">{p.accepted} of {p.total} accepted</span>
                    <span className={cn("rounded-full px-2 text-xs leading-5 font-semibold whitespace-nowrap", TONE[p.status.tone])}>{p.status.text}</span>
                  </span>
                </Combobox.Item>)}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>);
}
