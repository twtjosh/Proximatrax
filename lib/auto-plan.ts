/**
 * Turns the work breakdown Gemini drafts into a schedule the database can
 * trust: every date on a working day inside the project, milestones in
 * order with strictly increasing due dates, and each task planned for the
 * least-loaded crew member with the right role. AI decides what; these rules
 * decide when and who. No imports, so `node --test` can run it.
 */

export type CrewRole = "site_manager" | "foreman" | "safety_officer";
export type DraftTask = { title: string; description: string; workingDays: number; role: CrewRole };
export type DraftMilestone = { title: string; tasks: DraftTask[] };
export type TeamMember = { id: string; name: string; role: CrewRole | null };
export type PlannedTask = DraftTask & { start_date: string; due_date: string; planned_to: string | null };
export type PlannedMilestone = { title: string; due_date: string; tasks: PlannedTask[] };
/** weekdays: 0 = Sunday … 6 = Saturday. Dates are ISO calendar dates. */
export type Calendar = { start: string; end: string; weekdays: number[]; offDates: string[] };

export const LIMITS = { minMilestones: 2, maxMilestones: 8, maxTasksPerMilestone: 15, maxTasks: 60, minDays: 1, maxDays: 30 } as const;
export const CREW_ROLES: readonly CrewRole[] = ["site_manager", "foreman", "safety_officer"];

const DAY = 86_400_000;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

/** Gemini's answer, cut down to what the plan allows; null when fewer than two milestones survive. */
export function sanitizeDraft(raw: unknown): DraftMilestone[] | null {
    const list = raw && typeof raw === "object" ? (raw as { milestones?: unknown }).milestones : null;
    if (!Array.isArray(list))
        return null;
    const out: DraftMilestone[] = [];
    let total = 0;
    for (const m of list) {
        if (out.length >= LIMITS.maxMilestones || total >= LIMITS.maxTasks)
            break;
        const o = (m && typeof m === "object" ? m : {}) as { title?: unknown; tasks?: unknown };
        const title = text(o.title, 120);
        const tasks: DraftTask[] = [];
        for (const t of Array.isArray(o.tasks) ? o.tasks : []) {
            if (tasks.length >= LIMITS.maxTasksPerMilestone || total + tasks.length >= LIMITS.maxTasks)
                break;
            const r = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
            const taskTitle = text(r.title, 160);
            if (!taskTitle)
                continue;
            const days = Math.round(Number(r.workingDays));
            tasks.push({
                title: taskTitle,
                description: text(r.description, 600),
                workingDays: Number.isFinite(days) ? Math.min(LIMITS.maxDays, Math.max(LIMITS.minDays, days)) : LIMITS.minDays,
                role: CREW_ROLES.includes(r.role as CrewRole) ? (r.role as CrewRole) : "foreman",
            });
        }
        if (!title || tasks.length === 0)
            continue;
        out.push({ title, tasks });
        total += tasks.length;
    }
    return out.length >= LIMITS.minMilestones ? out : null;
}

/** Every date from start to end that is on a ticked weekday and not an off date. */
export function workingDays(cal: Calendar): string[] {
    const from = Date.parse(`${cal.start}T00:00:00Z`), to = Date.parse(`${cal.end}T00:00:00Z`);
    if (Number.isNaN(from) || Number.isNaN(to))
        return [];
    const off = new Set(cal.offDates);
    const days: string[] = [];
    for (let t = from; t <= to; t += DAY) {
        const iso = new Date(t).toISOString().slice(0, 10);
        if (cal.weekdays.includes(new Date(t).getUTCDay()) && !off.has(iso))
            days.push(iso);
    }
    return days;
}

/** Splits `total` into one share per weight, each at least 1, in proportion (largest remainder). Needs total >= weights.length. */
function shares(weights: number[], total: number): number[] {
    const out = weights.map(() => 1);
    const spare = total - weights.length;
    const sum = weights.reduce((a, b) => a + b, 0);
    const exact = weights.map((w) => (w / sum) * spare);
    exact.forEach((e, i) => (out[i] += Math.floor(e)));
    let left = total - out.reduce((a, b) => a + b, 0);
    const order = exact.map((e, i) => [e - Math.floor(e), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (const [, i] of order) {
        if (left-- <= 0)
            break;
        out[i]++;
    }
    return out;
}

/**
 * Milestones and their tasks run one after another, stretched so the last
 * task ends on the last working day.
 * ponytail: sequential tasks only; parallel tracks if crews must overlap.
 */
export function schedule(draft: DraftMilestone[], cal: Calendar): PlannedMilestone[] | { error: "too_short" } {
    const days = workingDays(cal);
    if (draft.length === 0 || days.length < draft.length)
        return { error: "too_short" };
    const perMilestone = shares(draft.map((m) => m.tasks.reduce((a, t) => a + t.workingDays, 0)), days.length);
    let cursor = 0;
    return draft.map((m, mi) => {
        const slice = days.slice(cursor, cursor + perMilestone[mi]);
        cursor += perMilestone[mi];
        const n = m.tasks.length;
        let tasks: PlannedTask[];
        if (slice.length >= n) {
            const perTask = shares(m.tasks.map((t) => t.workingDays), slice.length);
            let at = 0;
            tasks = m.tasks.map((t, ti) => {
                const start = slice[at];
                at += perTask[ti];
                return { ...t, start_date: start, due_date: slice[at - 1], planned_to: null };
            });
        }
        else {
            tasks = m.tasks.map((t, ti) => {
                const day = slice[Math.floor((ti * slice.length) / n)];
                return { ...t, start_date: day, due_date: day, planned_to: null };
            });
        }
        return { title: m.title, due_date: slice.at(-1)!, tasks };
    });
}

/** Each task goes to the least-loaded member with its role, or the least-loaded member when nobody has it. */
export function assign(plan: PlannedMilestone[], team: TeamMember[]): PlannedMilestone[] {
    const load = new Map(team.map((p) => [p.id, 0]));
    return plan.map((m) => ({
        ...m,
        tasks: m.tasks.map((t) => {
            const withRole = team.filter((p) => p.role === t.role);
            const pool = withRole.length > 0 ? withRole : team;
            let pick: TeamMember | null = null;
            for (const p of pool)
                if (!pick || load.get(p.id)! < load.get(pick.id)!)
                    pick = p;
            if (pick)
                load.set(pick.id, load.get(pick.id)! + t.workingDays);
            return { ...t, planned_to: pick?.id ?? null };
        }),
    }));
}

/**
 * What is wrong with a plan sent back from the review screen, or null. The
 * PM may edit it there, so the server checks it again before saving.
 */
export function planProblem(plan: unknown, cal: Calendar, team: string[]): string | null {
    if (!Array.isArray(plan))
        return "The plan is missing.";
    const ms = plan as PlannedMilestone[];
    if (ms.length < LIMITS.minMilestones || ms.length > LIMITS.maxMilestones)
        return `A plan has ${LIMITS.minMilestones} to ${LIMITS.maxMilestones} milestones.`;
    const days = new Set(workingDays(cal));
    let total = 0, previous = "";
    for (const m of ms) {
        if (!m || typeof m.title !== "string" || !m.title.trim())
            return "Every milestone needs a title.";
        if (!Array.isArray(m.tasks) || m.tasks.length < 1 || m.tasks.length > LIMITS.maxTasksPerMilestone)
            return `Each milestone has 1 to ${LIMITS.maxTasksPerMilestone} tasks.`;
        if (!days.has(m.due_date))
            return `${m.title}: its date is not a working day in the project.`;
        if (m.due_date <= previous)
            return "Milestones must end in order, each after the one before.";
        previous = m.due_date;
        for (const t of m.tasks) {
            if (!t || typeof t.title !== "string" || !t.title.trim())
                return "Every task needs a title.";
            if (!Number.isInteger(t.workingDays) || t.workingDays < LIMITS.minDays || t.workingDays > LIMITS.maxDays)
                return `${t.title}: working days must be ${LIMITS.minDays} to ${LIMITS.maxDays}.`;
            if (!days.has(t.start_date) || !days.has(t.due_date) || t.start_date > t.due_date || t.due_date > m.due_date)
                return `${t.title}: its dates are outside the plan.`;
            if (t.planned_to !== null && !team.includes(t.planned_to))
                return `${t.title}: planned for someone not on the team.`;
            if (!CREW_ROLES.includes(t.role))
                return `${t.title}: unknown crew role.`;
        }
        total += m.tasks.length;
    }
    return total > LIMITS.maxTasks ? `A plan has at most ${LIMITS.maxTasks} tasks.` : null;
}

export function buildPlan(raw: unknown, cal: Calendar, team: TeamMember[]): PlannedMilestone[] | { error: "invalid" | "too_short" } {
    const draft = sanitizeDraft(raw);
    if (!draft)
        return { error: "invalid" };
    const planned = schedule(draft, cal);
    return "error" in planned ? planned : assign(planned, team);
}
