"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Check, CornerDownLeft, Flag, Loader2, Plus, UserRound, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Face, focusRing } from "@/components/dashboard/overview-kit";
import { QUICK_ADD_EVENT } from "@/components/projects/pm/project-shortcuts";
import { addDays, formatDate } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { parseQuickAdd } from "@/lib/quick-add";
import { milestoneTaskDates } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { personTitle } from "@/lib/vocabulary";
import { logActivity } from "@/services/activity-service";
import { createTask, type TaskWithRelations } from "@/services/task-service";
import { notifyWorkReadyAfterProjectTaskChange, snapshotProjectTasksForNotify } from "@/services/work-notification-service";
import type { Milestone, Profile } from "@/types/database";

type Panel = "who" | "milestone" | "due" | null;
/** A field the PM set by hand; `undefined` means "take what the title says". */
type Picked<T> = T | undefined;
type Draft = { text: string; who: Picked<string | null>; milestone: Picked<string | null>; due: Picked<string | null> };
const EMPTY: Draft = { text: "", who: undefined, milestone: undefined, due: undefined };

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const short = (iso: string) => formatDate(iso, { weekday: "short", month: "short", day: "numeric" });
const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/**
 * New task: a button in the board's toolbar (or N anywhere on the project)
 * opening a small composer. A name, then who does it, which milestone and
 * when; typing "@ana", "#finishing" or "fri" in the name fills those too.
 * Enter adds it to To do. The draft survives closing, and "Add another"
 * keeps the composer open with the same person, milestone and day.
 */
export function TaskComposer({ projectId, people, milestones, projectStart, today, onAdded }: {
    projectId: string;
    people: Profile[];
    milestones: Milestone[];
    projectStart: string;
    today: string;
    onAdded: (task: TaskWithRelations) => void;
}) {
    const params = useSearchParams();
    const reduce = useReducedMotion();
    const input = React.useRef<HTMLInputElement>(null);
    const [open, setOpen] = React.useState(false);
    const [draft, setDraft] = React.useState<Draft>(EMPTY);
    const [panel, setPanel] = React.useState<Panel>(null);
    const [another, setAnother] = React.useState(false);
    const [busy, setBusy] = React.useState(false);

    // N anywhere on the project, or ?add=1 from another tab, opens it.
    React.useEffect(() => {
        const show = () => setOpen(true);
        window.addEventListener(QUICK_ADD_EVENT, show);
        return () => window.removeEventListener(QUICK_ADD_EVENT, show);
    }, []);
    React.useEffect(() => {
        if (params.get("add") !== "1")
            return;
        setOpen(true);
        const next = new URLSearchParams(window.location.search);
        next.delete("add");
        const qs = next.toString();
        window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    }, [params]);

    const lookup = { people: people.map((p) => ({ id: p.id, name: p.full_name })), milestones: milestones.map((m) => ({ id: m.id, title: m.title })), today };
    const parsed = parseQuickAdd(draft.text, lookup);
    const whoId = draft.who !== undefined ? draft.who : parsed.assigneeId;
    const milestoneId = draft.milestone !== undefined ? draft.milestone : parsed.milestoneId;
    const due = draft.due !== undefined ? draft.due : parsed.dueDate;
    const who = people.find((p) => p.id === whoId) ?? null;
    const ms = milestones.find((m) => m.id === milestoneId) ?? null;

    // "@an" or "#fin" at the end of the name offers matches; Tab takes the first.
    const word = /(?:^|\s)([@#])(\S*)$/.exec(draft.text);
    const suggestions = !word ? [] : word[1] === "@"
        ? people.filter((p) => p.full_name.toLowerCase().split(/\s+/).some((n) => n.startsWith(word[2].toLowerCase()))).slice(0, 4).map((p) => ({ id: p.id, label: p.full_name, insert: `@${p.full_name.split(/\s+/)[0]}` }))
        : milestones.filter((m) => squash(m.title).startsWith(squash(word[2]))).slice(0, 4).map((m) => ({ id: m.id, label: m.title, insert: `#${squash(m.title)}` }));
    const complete = (insert: string) => {
        setDraft((d) => ({ ...d, text: `${d.text.replace(/[@#]\S*$/, "")}${insert} ` }));
        input.current?.focus();
    };
    const set = (patch: Partial<Draft>) => {
        setDraft((d) => ({ ...d, ...patch }));
        setPanel(null);
        input.current?.focus();
    };

    async function add() {
        if (!parsed.title || busy)
            return;
        setBusy(true);
        try {
            const before = whoId ? await snapshotProjectTasksForNotify(projectId) : null;
            const created = await createTask({ project_id: projectId, title: parsed.title, assigned_to: whoId, milestone_id: milestoneId, due_date: due, ...milestoneTaskDates(milestoneId, milestones, projectStart, today, due), stage: "to_do" });
            void logActivity({ project_id: projectId, action_type: "task_created", details: { task_id: created.id, title: created.title } });
            if (before)
                void notifyWorkReadyAfterProjectTaskChange(projectId, before);
            onAdded({ ...created, assignee: who ? { id: who.id, full_name: who.full_name, avatar_url: who.avatar_url } : null, milestone: ms ? { id: ms.id, title: ms.title } : null });
            toast.success(`Added “${created.title}” to To do`);
            if (another) {
                // Same person, milestone and day for the next one; only the name clears.
                setDraft({ text: "", who: whoId, milestone: milestoneId, due });
                input.current?.focus();
            }
            else {
                setDraft(EMPTY);
                setPanel(null);
                setOpen(false);
            }
        }
        catch (e) {
            toast.error(errorText(e, "That task couldn't be added."));
        }
        finally {
            setBusy(false);
        }
    }

    const nextMonday = addDays(today, ((8 - new Date(`${today}T00:00:00Z`).getUTCDay()) % 7) || 7);
    const days = [["Today", today], ["Tomorrow", addDays(today, 1)], ["Next Monday", nextMonday], ["In a week", addDays(today, 7)]] as const;

    return (<Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPanel(null); }}>
      <Popover.Trigger className={cn("press group inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-brand pr-1.5 pl-3 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(120_53_15/0.25),0_8px_18px_-10px_rgb(180_83_9/0.6)] transition-colors hover:bg-brand-hover data-popup-open:bg-brand-hover", focusRing)}>
        <Plus className="size-4 transition-transform duration-300 ease-spring group-data-popup-open:rotate-45" aria-hidden/>
        New task
        <kbd className="grid h-6 min-w-6 place-items-center rounded-full bg-white/18 px-1.5 font-sans text-[11px] font-semibold" aria-hidden>N</kbd>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={10} collisionPadding={16} className="z-50">
          <Popover.Popup initialFocus={input} aria-label="New task" className="w-[min(30rem,calc(100vw-2rem))] origin-(--transform-origin) overflow-hidden rounded-[20px] bg-surface shadow-[0_0_0_1px_rgb(14_18_34/0.08),0_28px_56px_-24px_rgb(14_18_34/0.45),0_2px_6px_-2px_rgb(14_18_34/0.08)] transition-[opacity,scale,translate] duration-200 ease-spring data-ending-style:-translate-y-1 data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:-translate-y-1 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
            <form onSubmit={(e) => { e.preventDefault(); void add(); }}>
              <div className="px-5 pt-4">
                <p className="flex items-center gap-2 text-[11.5px] font-medium text-ink-tertiary">
                  <span className="size-1.5 rounded-full bg-stage-todo" aria-hidden/>New task <span aria-hidden>·</span> lands in To do
                </p>
                <label className="mt-1.5 block">
                  <span className="sr-only">Task name</span>
                  <input ref={input} value={draft.text} onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))} onKeyDown={(e) => {
                        if (e.key === "Tab" && suggestions[0] && !e.shiftKey) {
                            e.preventDefault();
                            complete(suggestions[0].insert);
                        }
                    }} placeholder="What needs doing?" autoComplete="off" className="h-11 w-full bg-transparent text-[19px] font-semibold tracking-[-0.018em] text-ink placeholder:font-medium placeholder:text-ink-tertiary/70 focus:outline-none"/>
                </label>
                <AnimatePresence initial={false}>
                  {suggestions.length > 0 ? (<motion.div initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={SPRING} className="overflow-hidden">
                      <div className="flex flex-wrap gap-1.5 pt-1 pb-1">
                        {suggestions.map((s, i) => (<button key={s.id} type="button" onClick={() => complete(s.insert)} className={cn("press inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-medium", i === 0 ? "bg-ink text-white" : "bg-surface-sunken text-ink-secondary hover:text-ink", focusRing)}>
                            {s.label}{i === 0 ? <kbd className="rounded bg-white/20 px-1 font-sans text-[10px]">Tab</kbd> : null}
                          </button>))}
                      </div>
                    </motion.div>) : null}
                </AnimatePresence>
              </div>

              <div className="flex flex-wrap gap-1.5 px-4 pt-2 pb-3.5">
                <Pill icon={UserRound} open={panel === "who"} set={!!who} label={who ? who.full_name.split(" ")[0] : "Assignee"} face={who ? { id: who.id, name: who.full_name, avatarUrl: who.avatar_url } : null} onClick={() => setPanel((p) => (p === "who" ? null : "who"))} onClear={() => set({ who: null, text: parsed.tokens.some((t) => t.kind === "person") ? strip(draft.text, "@") : draft.text })}/>
                {milestones.length ? <Pill icon={Flag} open={panel === "milestone"} set={!!ms} label={ms ? ms.title : "Milestone"} onClick={() => setPanel((p) => (p === "milestone" ? null : "milestone"))} onClear={() => set({ milestone: null, text: strip(draft.text, "#") })}/> : null}
                <Pill icon={CalendarDays} open={panel === "due"} set={!!due} label={due ? short(due) : "Due date"} tone={due && due < today ? "late" : undefined} onClick={() => setPanel((p) => (p === "due" ? null : "due"))} onClear={() => set({ due: null })}/>
              </div>

              <AnimatePresence initial={false} mode="wait">
                {panel ? (<motion.div key={panel} initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={SPRING} className="overflow-hidden border-t border-line bg-surface-subtle">
                    {panel === "who" ? (<Options label="Assign to">
                        <Option on={!who} onClick={() => set({ who: null })}><span className="grid size-7 place-items-center rounded-full border border-dashed border-line-strong text-ink-tertiary"><UserRound className="size-3.5" aria-hidden/></span><span className="flex-1">No one yet</span></Option>
                        {people.map((p) => (<Option key={p.id} on={who?.id === p.id} onClick={() => set({ who: p.id })}>
                            <Face person={{ id: p.id, name: p.full_name, avatarUrl: p.avatar_url, role: "" }} size={28}/>
                            <span className="min-w-0 flex-1"><span className="block truncate">{p.full_name}</span><span className="block text-xs text-ink-tertiary">{personTitle(p)}</span></span>
                          </Option>))}
                      </Options>) : panel === "milestone" ? (<Options label="Milestone">
                        <Option on={!ms} onClick={() => set({ milestone: null })}><span className="flex-1">No milestone</span></Option>
                        {milestones.map((m) => (<Option key={m.id} on={ms?.id === m.id} onClick={() => set({ milestone: m.id })}>
                            <Flag className="size-4 shrink-0 text-ink-tertiary" aria-hidden/>
                            <span className="min-w-0 flex-1 truncate">{m.title}</span>
                            <span className="text-xs text-ink-tertiary tabular">Due {formatDate(m.due_date, { month: "short", day: "numeric" })}</span>
                          </Option>))}
                      </Options>) : (<div className="grid gap-2.5 px-4 py-3.5">
                        <p className="text-[11.5px] font-medium text-ink-tertiary">Due</p>
                        <div className="flex flex-wrap gap-1.5">
                          {days.map(([name, iso]) => (<button key={name} type="button" onClick={() => set({ due: iso })} className={cn("press inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors", due === iso ? "bg-ink text-white" : "bg-surface text-ink shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1px_var(--line-strong)]", focusRing)}>
                              {name}<span className={cn("text-xs tabular", due === iso ? "text-white/65" : "text-ink-tertiary")}>{formatDate(iso, { month: "short", day: "numeric" })}</span>
                            </button>))}
                        </div>
                        <label className="flex items-center gap-2.5 text-[13px] text-ink-secondary">
                          Or pick a date
                          <input type="date" value={due ?? ""} min={projectStart} onChange={(e) => set({ due: e.target.value || null })} className={cn("h-8 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink tabular", focusRing)}/>
                        </label>
                      </div>)}
                  </motion.div>) : null}
              </AnimatePresence>

              <footer className="flex items-center gap-3 border-t border-line bg-surface-subtle/70 px-4 py-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-secondary select-none">
                  <button type="button" role="switch" aria-checked={another} onClick={() => setAnother((v) => !v)} className={cn("relative h-[18px] w-8 shrink-0 cursor-pointer rounded-full transition-colors duration-200", another ? "bg-copper" : "bg-line-strong", focusRing)}>
                    <span className={cn("absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-spring", another && "translate-x-3.5")}/>
                  </button>
                  Add another
                </label>
                <span className="ml-auto hidden text-xs text-ink-tertiary sm:inline">Type <kbd className="font-sans font-semibold text-ink-secondary">@</kbd> <kbd className="font-sans font-semibold text-ink-secondary">#</kbd> or a day</span>
                <button type="submit" disabled={!parsed.title || busy} className={cn("press inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-ink pr-2 pl-3.5 text-[13px] font-semibold text-white transition-opacity duration-200 disabled:cursor-default disabled:opacity-35 max-sm:ml-auto", focusRing)}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden/> : null}Add task
                  <span className="grid size-6 place-items-center rounded-full bg-white/15" aria-hidden><CornerDownLeft className="size-3"/></span>
                </button>
              </footer>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>);
}

/** Drops a "@word" or "#word" the PM typed once the pill it filled is cleared. */
function strip(text: string, mark: "@" | "#") {
    return text.replace(new RegExp(`(^|\\s)\\${mark}\\S+`, "g"), "$1").replace(/\s{2,}/g, " ");
}

function Pill({ icon: Icon, label, set, open, tone, face, onClick, onClear }: {
    icon: LucideIcon;
    label: string;
    set: boolean;
    open: boolean;
    tone?: "late";
    face?: { id: string; name: string; avatarUrl: string | null } | null;
    onClick: () => void;
    onClear: () => void;
}) {
    return (<span className={cn("inline-flex h-8 items-center rounded-full text-[13px] font-medium transition-[background-color,box-shadow,color] duration-200",
            open ? "bg-ink text-white" : set ? (tone === "late" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-hover") : "bg-surface text-ink-secondary shadow-[inset_0_0_0_1px_var(--line)] hover:text-ink hover:shadow-[inset_0_0_0_1px_var(--line-strong)]")}>
      <button type="button" aria-expanded={open} onClick={onClick} className={cn("inline-flex h-full max-w-48 cursor-pointer items-center gap-1.5 rounded-full pl-2.5", set ? "pr-1" : "pr-3", focusRing)}>
        {face ? <Face person={{ ...face, role: "" }} size={20}/> : <Icon className="size-3.5 shrink-0" aria-hidden/>}
        <span className="truncate">{label}</span>
      </button>
      {set ? (<button type="button" onClick={onClear} aria-label={`Clear ${label}`} className={cn("mr-1 grid size-6 cursor-pointer place-items-center rounded-full opacity-70 transition-opacity hover:bg-black/5 hover:opacity-100", focusRing)}>
          <X className="size-3" aria-hidden/>
        </button>) : null}
    </span>);
}

function Options({ label, children }: { label: string; children: React.ReactNode }) {
    return (<div className="px-2 py-2.5">
      <p className="px-2.5 pb-1.5 text-[11.5px] font-medium text-ink-tertiary">{label}</p>
      <ul role="listbox" aria-label={label} className="grid max-h-56 gap-0.5 overflow-y-auto overscroll-contain">{children}</ul>
    </div>);
}

function Option({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
    return (<li role="none">
      <button type="button" role="option" aria-selected={on} onClick={onClick} className={cn("flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] text-ink transition-colors", on ? "bg-brand-soft" : "hover:bg-surface", focusRing)}>
        {children}
        {on ? <Check className="size-4 shrink-0 text-brand" aria-hidden/> : null}
      </button>
    </li>);
}
