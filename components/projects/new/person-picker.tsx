"use client";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search, UserPlus } from "lucide-react";
import { Face } from "@/components/dashboard/overview-kit";
import { cn } from "@/lib/utils";

export type PersonOption = { id: string; name: string; avatarUrl: string | null; context: string };

const asMember = (p: PersonOption) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl, role: "" });

/**
 * Picks one person: a button that shows who is chosen and how they relate to
 * this PM, opening a searchable list. Keyboard and screen-reader behaviour
 * come from Base UI's combobox.
 */
export function PersonPicker({ id, label, noun, people, value, onChange, help }: {
    id: string;
    label: string;
    /** "client", "middleman": used in the prompt and the empty state. */
    noun: string;
    people: PersonOption[];
    value: string;
    onChange: (id: string) => void;
    help: string;
}) {
    const selected = people.find((p) => p.id === value) ?? null;
    return (<div className="flex min-w-0 flex-col gap-1.5">
      <span id={`${id}-label`} className="text-[13px] font-medium text-ink">{label}</span>
      <Combobox.Root items={people} value={selected} onValueChange={(p) => onChange(p?.id ?? "")} itemToStringLabel={(p: PersonOption) => p.name} isItemEqualToValue={(a: PersonOption, b: PersonOption) => a.id === b.id}>
        <Combobox.Trigger id={id} aria-labelledby={`${id}-label`} aria-describedby={`${id}-help`} className="group flex min-h-14 w-full items-center gap-3 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-left outline-none transition-[border-color,box-shadow] hover:border-ink-tertiary/50 focus-visible:border-copper focus-visible:ring-4 focus-visible:ring-copper/15 data-popup-open:border-copper data-popup-open:ring-4 data-popup-open:ring-copper/15">
          {selected
            ? <Face person={asMember(selected)} size={34}/>
            : <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-surface-sunken text-ink-tertiary" aria-hidden><UserPlus className="size-4"/></span>}
          <span className="min-w-0 flex-1">
            {selected
                ? (<><span className="block truncate text-[14.5px] font-medium text-ink">{selected.name}</span><span className="block truncate text-xs text-ink-tertiary">{selected.context}</span></>)
                : <span className="text-[14.5px] text-ink-tertiary">Choose a {noun}</span>}
          </span>
          <ChevronDown className="size-4 shrink-0 text-ink-tertiary transition-transform group-data-popup-open:rotate-180" aria-hidden/>
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={6} className="z-50 w-(--anchor-width)">
            <Combobox.Popup className="origin-(--transform-origin) overflow-hidden rounded-2xl bg-surface shadow-[0_0_0_1px_rgb(14_18_34/0.08),0_24px_48px_-20px_rgb(14_18_34/0.35)] transition-[opacity,scale] duration-200 ease-[var(--ease-spring)] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
              <label className="flex items-center gap-2 border-b border-line px-3.5">
                <Search className="size-4 text-ink-tertiary" aria-hidden/>
                <Combobox.Input placeholder={`Search ${noun}s`} className="h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-tertiary"/>
              </label>
              <Combobox.Empty className="px-4 py-5 text-sm text-ink-tertiary empty:hidden">No {noun} matches that name.</Combobox.Empty>
              <Combobox.List className="max-h-72 overflow-y-auto p-1.5 empty:p-0">
                {(p: PersonOption) => (<Combobox.Item key={p.id} value={p} className={cn("flex cursor-default items-center gap-2.5 rounded-[10px] px-2.5 py-2 outline-none select-none data-highlighted:bg-surface-subtle data-selected:bg-brand-soft")}>
                    <Face person={asMember(p)} size={30}/>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{p.name}</span>
                      <span className="block truncate text-xs text-ink-tertiary">{p.context}</span>
                    </span>
                    <Combobox.ItemIndicator><Check className="size-4 text-brand" aria-hidden/></Combobox.ItemIndicator>
                  </Combobox.Item>)}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      <span id={`${id}-help`} className="text-xs text-ink-tertiary">{people.length === 0 ? `No ${noun} accounts yet. The super admin creates them.` : help}</span>
    </div>);
}
