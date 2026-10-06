"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { focusRing, OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import { projectBoardPath, projectPath, projectTimelinePath } from "@/lib/constants";
import { addDays, daysBetween, formatDate, groupByProject, isoDateIn, plural, relativePast, type Deadline, type ProjectLoad } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import { updateMilestone, type ProjectWithRelations } from "@/services/project-service";

/** Rows shown before "Show more". */
const FOLD_AT = 5;

/** Milestones open on the timeline; tasks open the board filtered to that task. */
export function deadlineHref(d: Deadline) {
    return d.kind === "milestone" ? projectTimelinePath(d.project_id) : projectBoardPath(d.project_id, { view: "all", q: d.title });
}

/** Row-sized actions: small, quiet until needed. */
const mini = cn("press inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium [&_svg]:size-3.5", focusRing);
const ghost = "text-ink-secondary hover:bg-surface-sunken hover:text-ink";
/** With a mouse, actions appear when the row is pointed at or focused; on touch they always show. */
const reveal = "transition-[opacity,translate] duration-[400ms] ease-spring [@media(hover:hover)]:translate-x-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/item:translate-x-0 [@media(hover:hover)]:group-hover/item:opacity-100 [@media(hover:hover)]:group-focus-within/item:translate-x-0 [@media(hover:hover)]:group-focus-within/item:opacity-100";

const keyOf = (d: Deadline) => `${d.kind}-${d.id}`;

const TONES = {
    review: "bg-warning-soft text-warning",
    late: "bg-danger-soft text-danger",
    close: "bg-success-soft text-success",
} as const;

const rowLeave = { initial: false, exit: { opacity: 0, height: 0 }, transition: SPRING } as const;

/**
 * Everything waiting on the PM, and the means to deal with most of it here:
 * overdue milestones can be marked delivered or moved without leaving the
 * Overview. Overdue work is grouped per project; a group opens in place.
 */
export function NeedsYou({ overdue, projects, loads, readyToClose, titleOf, today }: {
    overdue: Deadline[];
    projects: ProjectWithRelations[];
    loads: Map<string, ProjectLoad>;
    readyToClose: ProjectWithRelations[];
    titleOf: (id: string) => string;
    today: string;
}) {
    const router = useRouter();
    const [resolved, setResolved] = React.useState<Set<string>>(() => new Set());
    const [openGroup, setOpenGroup] = React.useState<string | null>(null);
    const [expanded, setExpanded] = React.useState(false);

    const resolve = React.useCallback((d: Deadline) => {
        setResolved((prev) => new Set(prev).add(keyOf(d)));
        router.refresh();
    }, [router]);

    const reviews = projects.filter((p) => loads.get(p.id)!.inReview.length > 0).sort((a, b) => loads.get(b.id)!.inReview.length - loads.get(a.id)!.inReview.length);
    const lateGroups = groupByProject(overdue.filter((d) => !resolved.has(keyOf(d))));

    const rows: { key: string; node: React.ReactNode }[] = [
        ...reviews.map((p) => {
            const waiting = loads.get(p.id)!.inReview;
            const oldest = waiting.reduce((min, t) => (t.updated_at < min ? t.updated_at : min), waiting[0].updated_at);
            return {
                key: `r-${p.id}`,
                node: (<LinkRow href={projectBoardPath(p.id)} tone="review" badge={waiting.length} action="Review" meta={relativePast(isoDateIn(oldest), today)} title={waiting.length === 1 ? `Review ${waiting[0].title}` : `Review ${waiting.length} submissions`} detail={waiting.length === 1 ? p.title : `${p.title} · ${waiting.slice(0, 2).map((t) => t.title).join(", ")}${waiting.length > 2 ? "…" : ""}`}/>),
            };
        }),
        ...lateGroups.map((late) => {
            const first = late[0];
            if (late.length === 1)
                return { key: keyOf(first), node: <OverdueItem deadline={first} project={titleOf(first.project_id)} today={today} onResolved={resolve} badge/> };
            const open = openGroup === first.project_id;
            return {
                key: `g-${first.project_id}`,
                node: (<div>
                  <button type="button" aria-expanded={open} onClick={() => setOpenGroup(open ? null : first.project_id)} className={cn("group flex w-full cursor-pointer items-center gap-3.5 px-5 py-3 text-left transition-colors duration-300 ease-spring hover:bg-surface-subtle sm:px-6", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-[11px] text-[13px] font-bold tabular", TONES.late)} aria-hidden>{late.length}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{late.length} items overdue in {titleOf(first.project_id)}</span>
                      <span className="block truncate text-xs text-ink-tertiary">Oldest {plural(daysBetween(first.due_date, today), "day")} late · {late.slice(0, 2).map((d) => d.title).join(", ")}{late.length > 2 ? "…" : ""}</span>
                    </span>
                    <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SPRING} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-tertiary group-hover:bg-surface-sunken" aria-hidden>
                      <ChevronDown className="size-4"/>
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open ? (<motion.ul key="items" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING} className="overflow-hidden bg-surface-subtle/70">
                        <AnimatePresence initial={false}>
                          {late.map((d) => (<motion.li key={keyOf(d)} {...rowLeave} className="overflow-hidden border-t border-line">
                              <OverdueItem deadline={d} today={today} onResolved={resolve} nested/>
                            </motion.li>))}
                        </AnimatePresence>
                      </motion.ul>) : null}
                  </AnimatePresence>
                </div>),
            };
        }),
        ...readyToClose.map((p) => ({
            key: `c-${p.id}`,
            node: <LinkRow href={projectPath(p.id)} tone="close" badge={<Check className="size-3.5" strokeWidth={2.5}/>} action="Close" title={`${p.title} is ready to close`} detail="Every milestone delivered and all work accepted"/>,
        })),
    ];
    const shown = expanded ? rows : rows.slice(0, FOLD_AT);

    return (<OverviewCard id="needs-heading" title="Needs you" count={rows.length} className="materialize" style={stagger(6)}>
      {rows.length === 0 ? (<p className="flex items-center gap-3 px-6 pt-2 pb-6 text-sm text-ink-secondary">
          <span className="grid size-8 place-items-center rounded-[10px] bg-success-soft text-success"><Check className="size-4" aria-hidden/></span>
          You&apos;re all caught up.
        </p>) : (<ul className="pb-2">
          <AnimatePresence initial={false}>
            {shown.map((r) => <motion.li key={r.key} {...rowLeave} className="overflow-hidden border-t border-line first:border-t-0">{r.node}</motion.li>)}
          </AnimatePresence>
        </ul>)}
      {rows.length > FOLD_AT ? (<div className="border-t border-line px-3 py-2">
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)} className={cn("press h-9 w-full cursor-pointer rounded-xl px-3 text-left text-sm font-medium text-ink-secondary hover:bg-surface-sunken hover:text-ink", focusRing)}>
            {expanded ? "Show less" : `Show ${rows.length - FOLD_AT} more`}
          </button>
        </div>) : null}
    </OverviewCard>);
}

function LinkRow({ href, tone, badge, title, detail, meta, action }: {
    href: string;
    tone: keyof typeof TONES;
    badge: React.ReactNode;
    title: string;
    detail: string;
    meta?: string;
    action: string;
}) {
    return (<Link href={href} className={cn("group flex items-center gap-3.5 px-5 py-3 transition-colors duration-300 ease-spring hover:bg-surface-subtle sm:px-6", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-[11px] text-[13px] font-bold tabular", TONES[tone])} aria-hidden>{badge}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{title}</span>
        <span className="block truncate text-xs text-ink-tertiary">{detail}</span>
      </span>
      {meta ? <span className="shrink-0 text-xs text-ink-tertiary tabular">{meta}</span> : null}
      <span className="press shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-canvas transition-[opacity,translate] duration-[450ms] ease-spring [@media(hover:hover)]:translate-x-1.5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-x-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-visible:translate-x-0 [@media(hover:hover)]:group-focus-visible:opacity-100" aria-hidden>
        {action}
      </span>
    </Link>);
}

/**
 * One overdue item with what the PM can do about it here. Milestones can be
 * marked delivered (the client is told, as from the timeline) or moved to a
 * new date; tasks open on the board, where acceptance happens.
 */
function OverdueItem({ deadline: d, project, today, onResolved, badge = false, nested = false }: {
    deadline: Deadline;
    /** Named when the row stands alone rather than inside its project's group. */
    project?: string;
    today: string;
    onResolved: (d: Deadline) => void;
    badge?: boolean;
    nested?: boolean;
}) {
    const [picking, setPicking] = React.useState(false);
    const [date, setDate] = React.useState(() => addDays(today, 7));
    const [busy, setBusy] = React.useState<"deliver" | "move" | null>(null);
    const late = daysBetween(d.due_date, today);
    const dateId = React.useId();

    async function run(kind: "deliver" | "move") {
        setBusy(kind);
        try {
            if (kind === "deliver") {
                await updateMilestone({ id: d.id, completed: true });
                await logActivity({ project_id: d.project_id, action_type: "milestone_completed", details: { milestone_id: d.id, title: d.title } });
                toast.success(`${d.title} marked delivered`);
            }
            else {
                await updateMilestone({ id: d.id, due_date: date });
                await logActivity({ project_id: d.project_id, action_type: "milestone_rescheduled", details: { milestone_id: d.id, title: d.title, due_date: date } });
                toast.success(`${d.title} moved to ${formatDate(date, { month: "short", day: "numeric" })}`);
            }
            onResolved(d);
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "That didn't save. Try again.");
            setBusy(null);
        }
    }

    return (<div className={cn("group/item flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 pr-4 transition-colors duration-300 ease-spring hover:bg-surface-subtle sm:pr-5", nested ? "pl-17 sm:pl-18" : "pl-5 sm:pl-6")}>
      {badge ? <span className={cn("grid size-9 shrink-0 place-items-center rounded-[11px] text-[13px] font-bold", TONES.late)} aria-hidden>!</span> : null}
      <span className="min-w-0 flex-1">
        <Link href={deadlineHref(d)} className={cn("block truncate rounded-sm text-sm font-medium text-ink transition-colors duration-300 hover:text-brand", focusRing)}>{d.title}</Link>
        <span className="block truncate text-xs text-ink-tertiary">
          <span className="text-danger">{plural(late, "day")} late</span> · {d.kind === "milestone" ? "Milestone" : "Task"}{project ? ` · ${project}` : ""}
        </span>
      </span>

      {d.kind === "task" ? (<Link href={deadlineHref(d)} className={cn(mini, ghost, reveal)}>Open on board</Link>) : picking ? (<span className="flex items-center gap-1.5">
          <label htmlFor={dateId} className="sr-only">New due date for {d.title}</label>
          <input id={dateId} type="date" value={date} min={today} autoFocus onChange={(e) => setDate(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && date) void run("move"); if (e.key === "Escape") setPicking(false); }} className={cn("h-7 rounded-full border border-line-strong bg-surface px-2.5 text-xs text-ink tabular", focusRing)}/>
          <button type="button" disabled={!date || busy !== null} onClick={() => void run("move")} className={cn(mini, "bg-ink text-canvas hover:bg-ink/88 disabled:opacity-50")}>
            {busy === "move" ? <Loader2 className="animate-spin" aria-hidden/> : null}
            Save
          </button>
          <button type="button" disabled={busy !== null} onClick={() => setPicking(false)} className={cn(mini, ghost)}>Cancel</button>
        </span>) : (<span className={cn("flex items-center gap-1", busy === null && reveal)}>
          <button type="button" disabled={busy !== null} onClick={() => setPicking(true)} className={cn(mini, ghost)}>
            <CalendarClock aria-hidden/>
            Reschedule
          </button>
          <button type="button" disabled={busy !== null} onClick={() => void run("deliver")} className={cn(mini, "bg-brand-soft text-brand hover:bg-brand hover:text-white disabled:opacity-60")}>
            {busy === "deliver" ? <Loader2 className="animate-spin" aria-hidden/> : <Check aria-hidden/>}
            Delivered
          </button>
        </span>)}
    </div>);
}
