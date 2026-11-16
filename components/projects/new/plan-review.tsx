"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowDown, ArrowUp, ChevronLeft, Loader2, Lock, Plus, RefreshCw, Trash2 } from "lucide-react";
import { focusRing, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import type { CrewOption } from "@/components/projects/new/team-cards";
import { assign, LIMITS, schedule, type CrewRole, type PlannedMilestone } from "@/lib/auto-plan";
import { projectPath } from "@/lib/constants";
import { formatDate } from "@/lib/dashboard";
import { intakeCalendar, TOO_SHORT, type Intake } from "@/lib/project-intake";
import { cn, getErrorMessage } from "@/lib/utils";
import { CLASSIFICATION_TERMS } from "@/lib/vocabulary";

/** One editable task; `pick` is the PM's own choice of person (undefined: the rules choose). */
type Row = { key: string; title: string; description: string; workingDays: number; role: CrewRole; pick?: string | null };
type Group = { key: string; title: string; tasks: Row[] };

let seq = 0;
const key = () => `k${++seq}`;
const fromPlan = (plan: PlannedMilestone[]): Group[] => plan.map((m) => ({ key: key(), title: m.title, tasks: m.tasks.map((t) => ({ key: key(), title: t.title, description: t.description, workingDays: t.workingDays, role: t.role })) }));
const move = <T,>(list: T[], from: number, to: number) => {
    const copy = [...list];
    copy.splice(to, 0, ...copy.splice(from, 1));
    return copy;
};

/**
 * The drafted plan, for the PM to check and adjust before it becomes the
 * project. Every edit is re-scheduled by the same rules the server checks,
 * so the dates shown are the dates saved. Confirming locks the plan.
 */
export function PlanReview({ intake, plan, crew, clientName, onBack, onRegenerate, regenerating, regenerateError, onConfirmed }: {
    intake: Intake;
    plan: PlannedMilestone[];
    crew: CrewOption[];
    clientName: string;
    onBack: () => void;
    onRegenerate: () => Promise<void>;
    regenerating: boolean;
    regenerateError: string | null;
    /** The project exists: forget the browser's draft of the report. */
    onConfirmed: () => void;
}) {
    const router = useRouter();
    const [groups, setGroups] = React.useState<Group[]>(() => fromPlan(plan));
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    React.useEffect(() => setGroups(fromPlan(plan)), [plan]);

    const team = React.useMemo(() => crew.filter((p) => intake.team.includes(p.id)), [crew, intake.team]);
    const result = React.useMemo(() => {
        const draft = groups.map((g) => ({ title: g.title, tasks: g.tasks.map(({ title, description, workingDays, role }) => ({ title, description, workingDays, role })) }));
        const timed = schedule(draft, intakeCalendar(intake));
        if ("error" in timed)
            return timed;
        return assign(timed, team.map((p) => ({ id: p.id, name: p.name, role: p.role }))).map((m, mi) => ({
            ...m,
            tasks: m.tasks.map((t, ti) => {
                const pick = groups[mi].tasks[ti].pick;
                return pick === undefined ? t : { ...t, planned_to: pick };
            }),
        }));
    }, [groups, intake, team]);
    const planned = "error" in result ? null : result;
    const total = groups.reduce((n, g) => n + g.tasks.length, 0);
    const blank = groups.some((g) => !g.title.trim() || g.tasks.some((t) => !t.title.trim()));
    const day = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

    const editGroup = (gi: number, p: Partial<Group>) => setGroups((gs) => gs.map((g, n) => (n === gi ? { ...g, ...p } : g)));
    const editTask = (gi: number, ti: number, p: Partial<Row>) => setGroups((gs) => gs.map((g, n) => (n === gi ? { ...g, tasks: g.tasks.map((t, m) => (m === ti ? { ...t, ...p } : t)) } : g)));

    async function confirm() {
        if (!planned || blank || busy)
            return;
        setBusy(true);
        setError(null);
        try {
            const res = await fetch("/api/project-report/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intake, plan: planned }) });
            const data = (await res.json().catch(() => ({ error: "No answer from the server. Check Projects before trying again, in case it was created." }))) as { error?: string; projectId?: string };
            if (!res.ok || !data.projectId)
                throw new Error(data.error ?? "The project was not created.");
            onConfirmed();
            router.push(projectPath(data.projectId));
            router.refresh();
        }
        catch (e) {
            setError(getErrorMessage(e));
            setBusy(false);
        }
    }

    const shown = error ?? regenerateError;
    return (<div className="mx-auto w-full max-w-[56rem] pb-10">
      <button type="button" onClick={onBack} disabled={busy} className={cn("inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-ink-tertiary hover:text-ink", focusRing)}>
        <ChevronLeft className="size-4" aria-hidden/>Back to the report
      </button>
      <header className="materialize mt-2.5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] text-ink-tertiary">Drafted plan{clientName ? ` · ${clientName}` : ""}</p>
          <h1 className="mt-1 text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] break-words text-ink sm:text-[2.5rem]">{intake.title}</h1>
          <p className="mt-2 text-[15px] text-ink-secondary tabular">
            {groups.length} milestones · {total} tasks · {formatDate(intake.startDate, { month: "short", day: "numeric", year: "numeric" })} to {formatDate(intake.endDate, { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <button type="button" disabled={regenerating || busy} onClick={() => { if (window.confirm("Draft a new plan? Your edits here will be replaced.")) void onRegenerate(); }} className={cn(softAction, "h-10 px-4 disabled:opacity-45")}>
          {regenerating ? <Loader2 className="animate-spin" aria-hidden/> : <RefreshCw aria-hidden/>}{regenerating ? "Drafting…" : "Draft again"}
        </button>
      </header>

      {"error" in result ? <Alert text={`${TOO_SHORT} Go back and move the handover date, or remove some work.`}/> : null}
      {shown ? <Alert text={shown}/> : null}

      <ol className="mt-6 grid gap-4">
        {groups.map((g, gi) => {
            const m = planned?.[gi];
            return (<li key={g.key} className="materialize material rounded-[20px] p-4 sm:p-5" style={{ "--i": gi } as React.CSSProperties}>
            <div className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand tabular">{gi + 1}</span>
              <input aria-label={`Milestone ${gi + 1} title`} value={g.title} maxLength={120} onChange={(e) => editGroup(gi, { title: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[17px] font-semibold tracking-[-0.014em] text-ink outline-none hover:border-line focus:border-copper"/>
              <span className="shrink-0 text-[13px] text-ink-secondary tabular">{m ? `Due ${day(m.due_date)}` : ""}</span>
              <Order label={g.title || `milestone ${gi + 1}`} up={gi > 0 ? () => setGroups((gs) => move(gs, gi, gi - 1)) : null} down={gi < groups.length - 1 ? () => setGroups((gs) => move(gs, gi, gi + 1)) : null} remove={groups.length > LIMITS.minMilestones ? () => setGroups((gs) => gs.filter((_, n) => n !== gi)) : null}/>
            </div>
            <ul className="mt-3 grid gap-1.5">
              {g.tasks.map((t, ti) => {
                    const pt = m?.tasks[ti];
                    return (<li key={t.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-xl px-2 py-2 hover:bg-surface-subtle sm:grid-cols-[minmax(0,1fr)_5.5rem_8.5rem_11rem_auto]">
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <input aria-label="Task" value={t.title} maxLength={160} onChange={(e) => editTask(gi, ti, { title: e.target.value })} className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-[14px] font-medium text-ink outline-none hover:border-line focus:border-copper"/>
                    {t.description ? <p className="truncate px-2 text-xs text-ink-tertiary" title={t.description}>{t.description}</p> : null}
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-ink-tertiary">
                    <input type="number" min={LIMITS.minDays} max={LIMITS.maxDays} value={t.workingDays} onChange={(e) => editTask(gi, ti, { workingDays: Math.min(LIMITS.maxDays, Math.max(LIMITS.minDays, Math.round(Number(e.target.value) || 1))) })} aria-label={`Working days for ${t.title}`} className="h-8 w-12 rounded-lg border border-line bg-surface text-center text-[13px] text-ink tabular outline-none focus:border-copper"/>days
                  </label>
                  <span className="text-[12.5px] text-ink-secondary tabular">{pt ? (pt.start_date === pt.due_date ? day(pt.due_date) : `${day(pt.start_date)} – ${day(pt.due_date)}`) : "—"}</span>
                  <select aria-label={`Who does ${t.title}`} value={pt?.planned_to ?? ""} onChange={(e) => editTask(gi, ti, { pick: e.target.value || null })} className="h-8 min-w-0 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink outline-none focus:border-copper">
                    <option value="">Unassigned</option>
                    {team.map((p) => <option key={p.id} value={p.id}>{p.name}{p.role ? ` · ${CLASSIFICATION_TERMS[p.role]}` : ""}</option>)}
                  </select>
                  <Order label={t.title || "task"} up={ti > 0 ? () => editGroup(gi, { tasks: move(g.tasks, ti, ti - 1) }) : null} down={ti < g.tasks.length - 1 ? () => editGroup(gi, { tasks: move(g.tasks, ti, ti + 1) }) : null} remove={g.tasks.length > 1 ? () => editGroup(gi, { tasks: g.tasks.filter((_, n) => n !== ti) }) : null}/>
                </li>);
                })}
            </ul>
            {g.tasks.length < LIMITS.maxTasksPerMilestone && total < LIMITS.maxTasks ? (<button type="button" onClick={() => editGroup(gi, { tasks: [...g.tasks, { key: key(), title: "New task", description: "", workingDays: 1, role: "foreman" }] })} className={cn("press mt-2 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-ink-secondary hover:bg-surface-sunken hover:text-ink", focusRing)}>
                <Plus className="size-3.5" aria-hidden/>Add task
              </button>) : null}
          </li>);
        })}
      </ol>
      {groups.length < LIMITS.maxMilestones && total < LIMITS.maxTasks ? (<button type="button" onClick={() => setGroups((gs) => [...gs, { key: key(), title: "New milestone", tasks: [{ key: key(), title: "New task", description: "", workingDays: 1, role: "foreman" }] }])} className={cn("press mt-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3.5 text-[13px] font-medium text-ink-secondary hover:border-copper hover:text-brand", focusRing)}>
          <Plus className="size-4" aria-hidden/>Add milestone
        </button>) : null}

      <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-line bg-surface/95 px-4 pt-3 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:flex lg:items-center lg:justify-end lg:gap-4 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <p className="mb-2 flex items-start justify-center gap-1.5 text-center text-xs text-ink-tertiary lg:mb-0 lg:max-w-md lg:text-right lg:text-[13px]">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden/>{blank ? "Give every milestone and task a title." : "After this, milestones, tasks and dates can't be changed. Late work shows as late. Crew get their tasks when they accept."}
        </p>
        <button type="button" onClick={() => void confirm()} disabled={!planned || blank || busy || regenerating} className={cn(primaryAction, "h-11 w-full justify-center disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none lg:w-auto")}>
          {busy ? <Loader2 className="animate-spin" aria-hidden/> : <Lock aria-hidden/>}{busy ? "Creating the project…" : "Confirm & lock"}
        </button>
      </div>
    </div>);
}

function Alert({ text }: { text: string }) {
    return (<p role="alert" className="mt-5 flex gap-2 rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] text-danger">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden/><span>{text}</span>
    </p>);
}

function Order({ label, up, down, remove }: { label: string; up: (() => void) | null; down: (() => void) | null; remove: (() => void) | null }) {
    const btn = cn("press grid size-8 cursor-pointer place-items-center rounded-full text-ink-tertiary hover:bg-surface-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-30", focusRing);
    return (<span className="flex shrink-0 items-center">
      <button type="button" className={btn} disabled={!up} onClick={up ?? undefined} aria-label={`Move ${label} up`}><ArrowUp className="size-3.5" aria-hidden/></button>
      <button type="button" className={btn} disabled={!down} onClick={down ?? undefined} aria-label={`Move ${label} down`}><ArrowDown className="size-3.5" aria-hidden/></button>
      <button type="button" className={btn} disabled={!remove} onClick={remove ?? undefined} aria-label={`Remove ${label}`}><Trash2 className="size-3.5" aria-hidden/></button>
    </span>);
}
