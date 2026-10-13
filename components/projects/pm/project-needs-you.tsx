"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { TONES } from "@/components/dashboard/needs-you";
import { focusRing, OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { TeamMember } from "@/lib/data/project-context";
import { formatDate, isoDateIn, plural, relativeDay, relativePast } from "@/lib/dashboard";
import { projectBoardPath, projectReviewPath } from "@/lib/constants";
import { SPRING } from "@/lib/motion";
import { quickPickDates, type LateMilestone, type ProjectNeeds } from "@/lib/pm-project";
import { cn } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import { updateMilestone } from "@/services/project-service";

const rowLeave = { initial: false, exit: { opacity: 0, height: 0 }, transition: SPRING } as const;
const badge = "grid size-9 shrink-0 place-items-center rounded-[11px] text-[13px] font-bold tabular";
const action = cn("press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium", focusRing);
const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

/**
 * What this project needs from the PM, and the means to deal with most of it
 * here. Moving or delivering a milestone acts at once and offers Undo.
 */
export function ProjectNeedsYou({ projectId, needs, team, today, readOnly = false }: {
    projectId: string;
    needs: ProjectNeeds;
    team: TeamMember[];
    today: string;
    readOnly?: boolean;
}) {
    const router = useRouter();
    const [hidden, setHidden] = React.useState<Set<string>>(() => new Set());
    const hide = (id: string, on: boolean) => setHidden((prev) => {
        const next = new Set(prev);
        if (on)
            next.add(id);
        else
            next.delete(id);
        return next;
    });
    const firstName = (id: string | null) => (id ? team.find((m) => m.id === id)?.name.split(" ")[0] : undefined) ?? "the team";
    const milestones = needs.lateMilestones.filter((m) => !hidden.has(m.id));
    const count = needs.count - (needs.lateMilestones.length - milestones.length);

    async function change(m: LateMilestone, patch: { due_date?: string; completed?: boolean }, undo: { due_date?: string; completed?: boolean }, message: string) {
        hide(m.id, true);
        try {
            await updateMilestone({ id: m.id, ...patch });
            await logActivity(patch.completed
                ? { project_id: projectId, action_type: "milestone_completed", details: { milestone_id: m.id, title: m.title } }
                : { project_id: projectId, action_type: "milestone_rescheduled", details: { milestone_id: m.id, title: m.title, due_date: patch.due_date } });
            router.refresh();
            toast.success(message, {
                duration: 5000,
                action: {
                    label: "Undo",
                    onClick: () => {
                        void updateMilestone({ id: m.id, ...undo })
                            .then(() => { hide(m.id, false); router.refresh(); })
                            .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't undo. Try again from Schedule."));
                    },
                },
            });
        }
        catch (err) {
            hide(m.id, false);
            toast.error(err instanceof Error ? err.message : "That didn't save. Try again.");
        }
    }

    return (<OverviewCard id="project-needs" title="Needs you" count={count} className="materialize" style={stagger(2)}>
      {count === 0 ? (<p className="flex items-center gap-3 px-6 pt-2 pb-5 text-sm text-ink-secondary">
          <span className="grid size-8 place-items-center rounded-[10px] bg-success-soft text-success"><Check className="size-4" aria-hidden/></span>
          You&apos;re all caught up.
        </p>) : (<ul>
          <AnimatePresence initial={false}>
            {needs.review ? (<motion.li key="review" {...rowLeave} className="overflow-hidden border-t border-line first:border-t-0">
                <Link href={projectReviewPath(projectId)} className={cn("group flex items-center gap-3.5 px-5 py-3 transition-colors duration-300 ease-spring hover:bg-surface-subtle sm:px-6", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
                  <span className={cn(badge, TONES.review)} aria-hidden>{needs.review.count}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">Review {plural(needs.review.count, "submission")}</span>
                    <span className="block truncate text-xs text-ink-tertiary">Oldest from {firstName(needs.review.oldest.assigned_to)}, {relativePast(isoDateIn(needs.review.oldest.updated_at), today)}</span>
                  </span>
                  <span className={cn(action, "bg-brand text-white group-hover:bg-brand-hover")}>Start review</span>
                </Link>
              </motion.li>) : null}
            {milestones.map((m) => (<motion.li key={m.id} {...rowLeave} className="overflow-hidden border-t border-line first:border-t-0">
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 px-5 py-3 sm:px-6">
                  <span className={cn(badge, TONES.late)} aria-hidden>!</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{m.title} is {plural(m.daysLate, "day")} late</span>
                    <span className="block truncate text-xs text-ink-tertiary">Milestone{m.total > 0 ? ` · ${m.accepted} of ${plural(m.total, "task")} accepted` : ""}</span>
                  </span>
                  {readOnly ? null : (<span className="flex items-center gap-1.5">
                      {m.total > 0 && m.accepted === m.total ? (<button type="button" onClick={() => void change(m, { completed: true }, { completed: false }, `${m.title} marked delivered`)} className={cn(action, "bg-brand-soft text-brand hover:bg-brand hover:text-white")}>
                          <Check className="size-3.5" aria-hidden/>
                          Delivered
                        </button>) : null}
                      <MoveDate today={today} title={m.title} onPick={(date) => void change(m, { due_date: date }, { due_date: m.due_date }, `${m.title} moved to ${short(date)}`)}/>
                    </span>)}
                </div>
              </motion.li>))}
            {needs.lateTasks.map((t) => (<motion.li key={t.id} {...rowLeave} className="overflow-hidden border-t border-line first:border-t-0">
                <Link href={projectBoardPath(projectId, { view: "all", q: t.title })} className={cn("group flex items-center gap-3.5 px-5 py-3 transition-colors duration-300 ease-spring hover:bg-surface-subtle sm:px-6", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
                  <span className={cn(badge, TONES.late)} aria-hidden>{t.daysLate}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{t.title} is overdue</span>
                    <span className="block truncate text-xs text-ink-tertiary">{firstName(t.assigned_to)} · due {relativeDay(t.due_date, today).toLowerCase()}</span>
                  </span>
                  <span className={cn(action, "bg-surface-sunken text-ink group-hover:bg-line")}>Open</span>
                </Link>
              </motion.li>))}
          </AnimatePresence>
        </ul>)}
      {needs.comingUp.length > 0 ? (<div className="border-t border-line pb-2">
          <p className="px-5 pt-3 pb-1 text-[10px] font-semibold tracking-[0.07em] text-ink-tertiary uppercase sm:px-6">Coming up · next 7 days</p>
          <ul>
            {needs.comingUp.slice(0, 5).map((d) => (<li key={`${d.kind}-${d.id}`} className="flex items-center gap-3.5 px-5 py-2 sm:px-6">
                <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-surface-sunken text-[10px] font-semibold text-ink-secondary uppercase">{formatDate(d.due_date, { weekday: "short" })}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {d.kind === "milestone" ? <span className="mr-1.5 inline-block size-2 rotate-45 rounded-[2px] bg-copper align-middle" aria-label="Milestone"/> : null}
                  {d.title}
                </span>
                <span className="shrink-0 text-xs text-ink-tertiary">{relativeDay(d.due_date, today)}</span>
              </li>))}
          </ul>
        </div>) : null}
    </OverviewCard>);
}

/** "Move date": the common picks, or any date. */
function MoveDate({ today, title, onPick }: {
    today: string;
    title: string;
    onPick: (date: string) => void;
}) {
    const [custom, setCustom] = React.useState(false);
    const [date, setDate] = React.useState(today);
    const id = React.useId();
    if (custom)
        return (<span className="flex items-center gap-1.5">
        <label htmlFor={id} className="sr-only">New due date for {title}</label>
        <input id={id} type="date" value={date} min={today} autoFocus onChange={(e) => setDate(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && date) onPick(date); if (e.key === "Escape") setCustom(false); }} className={cn("h-8 rounded-full border border-line-strong bg-surface px-2.5 text-xs text-ink tabular", focusRing)}/>
        <button type="button" disabled={!date} onClick={() => onPick(date)} className={cn(action, "bg-ink text-canvas")}>Save</button>
      </span>);
    return (<DropdownMenu>
      <DropdownMenuTrigger className={cn(action, "cursor-pointer bg-surface-sunken text-ink hover:bg-line")}>Move date</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {quickPickDates(today).map((p) => (<DropdownMenuItem key={p.label} onClick={() => onPick(p.date)} className="justify-between gap-6">
            <span>{p.label}</span>
            <span className="text-xs text-ink-tertiary tabular">{relativeDay(p.date, today)}</span>
          </DropdownMenuItem>))}
        <DropdownMenuSeparator/>
        <DropdownMenuItem onClick={() => setCustom(true)}>Pick a date…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>);
}
