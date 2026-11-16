import { CREW_ROLES, LIMITS, type Calendar, type CrewRole } from "./auto-plan.ts";

/**
 * The project report a PM fills during or after the client interview, what
 * Gemini is told about it, and how a scanned copy is read back into it.
 * Pure, so `node --test` can run it. Dates are ISO calendar dates.
 */

export const WORK_TYPES = [
    "Demolition", "Carpentry", "Cabinetry", "Ceiling", "Electrical", "Plumbing", "Tiling",
    "Flooring", "Painting", "Wallpaper", "Curtains & blinds", "Furniture installation", "Cleaning & turnover",
] as const;

export type ScopeArea = { name: string; work: string[]; sqm: number | null; notes: string };
export type Intake = {
    title: string;
    clientId: string;
    site: { lat: number; lng: number } | null;
    startDate: string;
    endDate: string;
    /** Middleman profile ids. */
    team: string[];
    areas: ScopeArea[];
    /** 0 = Sunday … 6 = Saturday. */
    weekdays: number[];
    offDates: string[];
    notes: string;
};

export const emptyArea = (): ScopeArea => ({ name: "", work: [], sqm: null, notes: "" });

export function emptyIntake(today: string): Intake {
    return { title: "", clientId: "", site: null, startDate: today, endDate: "", team: [], areas: [emptyArea()], weekdays: [1, 2, 3, 4, 5, 6], offDates: [], notes: "" };
}

/** Projects run at most about three years; it also bounds the day-by-day scheduling. */
const MAX_SPAN_DAYS = 1095;

const listPhrase = (parts: string[]) => (parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]);

/** "Add a title, the team and the scope of work", or null when the report is ready to plan. */
export function intakeMissing(i: Intake): string | null {
    const missing = [
        !i.title.trim() && "a title",
        !i.clientId && "a client",
        !i.startDate && "a start date",
        !i.endDate && "an end date",
        i.startDate && i.endDate && i.endDate < i.startDate && "an end date after the start",
        i.startDate && i.endDate && Date.parse(i.endDate) - Date.parse(i.startDate) > MAX_SPAN_DAYS * 86_400_000 && "an end date within three years of the start",
        i.team.length === 0 && "the team",
        !i.areas.some((a) => a.name.trim() && a.work.length > 0) && "the scope of work",
        i.weekdays.length === 0 && "a working day",
    ].filter((m): m is string => Boolean(m));
    return missing.length === 0 ? null : `Add ${listPhrase(missing)}`;
}

export function intakeCalendar(i: Intake): Calendar {
    return { start: i.startDate, end: i.endDate, weekdays: [...i.weekdays].sort(), offDates: [...i.offDates] };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ROLE_WORDS: Record<CrewRole, string> = { site_manager: "site_manager", foreman: "foreman", safety_officer: "safety_officer" };

/** What Gemini is told. People are described by role only: their names and ids stay on our side. */
export function planPrompt(i: Intake, team: { name: string; role: CrewRole | null }[]): string {
    const roles = CREW_ROLES.map((r) => [r, team.filter((p) => p.role === r).length] as const).filter(([, n]) => n > 0);
    const areas = i.areas.filter((a) => a.name.trim() && a.work.length > 0).map((a) => [
        `- ${a.name.trim()}: ${a.work.join(", ")}`,
        a.sqm ? ` (about ${a.sqm} sqm)` : "",
        a.notes.trim() ? `. Notes: ${a.notes.trim()}` : "",
    ].join(""));
    return [
        "You plan interior fit-out and renovation jobs for a home fashion and interior design company in the Philippines.",
        "Break the job below into milestones and tasks for the site crew.",
        "",
        `Project: ${i.title.trim()}`,
        `Runs from ${i.startDate} to ${i.endDate}. Working days: ${[...i.weekdays].sort().map((d) => DAY_NAMES[d]).join(", ")}.${i.offDates.length ? ` No work on: ${i.offDates.join(", ")}.` : ""}`,
        "Scope of work by area:",
        ...areas,
        i.notes.trim() ? `Other notes from the client interview: ${i.notes.trim()}` : "",
        `Crew on the team: ${roles.length ? roles.map(([r, n]) => `${n} ${ROLE_WORDS[r]}`).join(", ") : "none listed"}.`,
        "",
        "Rules:",
        `- Make between ${LIMITS.minMilestones} and ${LIMITS.maxMilestones} milestones, listed in the order the work happens on site. Name each milestone for the stage of work it completes.`,
        `- Each milestone has 1 to ${LIMITS.maxTasksPerMilestone} tasks, in the order they are done; at most ${LIMITS.maxTasks} tasks in total.`,
        "- Each task is one clear piece of site work a crew can finish and photograph. Keep titles short (under 8 words); the description says what done looks like.",
        `- workingDays is a realistic whole number of working days for the task (${LIMITS.minDays} to ${LIMITS.maxDays}).`,
        `- role is the crew role best suited to lead the task: ${CREW_ROLES.join(", ")}. Prefer roles that are on the team.`,
        "- Do not include costs, prices, purchasing or materials ordering.",
    ].filter((line, n, all) => line !== "" || all[n - 1] !== "").join("\n");
}

export function readPrompt(): string {
    return [
        "This is a filled-in PROJECT REPORT form from an interior design company, printed from their system and completed by hand or typed.",
        "Read exactly what is written in each field. Do not guess or invent anything; leave a field empty (\"\" or []) when it is blank or unreadable.",
        "Dates: write them as YYYY-MM-DD. Working days: the ticked weekdays, as day names. Scope of work: one entry per area, with the ticked work types written exactly as printed on the form.",
    ].join("\n");
}

const str = { type: "string" };
const dates = { type: "array", items: str };

export const PLAN_SCHEMA = {
    type: "object",
    properties: {
        milestones: {
            type: "array",
            minItems: LIMITS.minMilestones,
            maxItems: LIMITS.maxMilestones,
            items: {
                type: "object",
                properties: {
                    title: str,
                    tasks: {
                        type: "array",
                        minItems: 1,
                        maxItems: LIMITS.maxTasksPerMilestone,
                        items: {
                            type: "object",
                            properties: {
                                title: str,
                                description: str,
                                workingDays: { type: "integer", minimum: LIMITS.minDays, maximum: LIMITS.maxDays },
                                role: { type: "string", enum: [...CREW_ROLES] },
                            },
                            required: ["title", "description", "workingDays", "role"],
                        },
                    },
                },
                required: ["title", "tasks"],
            },
        },
    },
    required: ["milestones"],
};

export const READ_SCHEMA = {
    type: "object",
    properties: {
        title: str,
        clientName: str,
        teamNames: { type: "array", items: str },
        startDate: str,
        endDate: str,
        areas: {
            type: "array",
            items: {
                type: "object",
                properties: { name: str, work: { type: "array", items: { type: "string", enum: [...WORK_TYPES] } }, sqm: { type: ["number", "null"] }, notes: str },
                required: ["name", "work", "sqm", "notes"],
            },
        },
        workingDays: { type: "array", items: str },
        offDates: dates,
        notes: str,
    },
    required: ["title", "clientName", "teamNames", "startDate", "endDate", "areas", "workingDays", "offDates", "notes"],
};

const norm = (s: unknown) => (typeof s === "string" ? s.trim().replace(/\s+/g, " ").toLowerCase() : "");
/** A real calendar date: "2026-02-31" parses in JavaScript but is not one. */
const isoDate = (s: unknown) => {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s))
        return "";
    const t = Date.parse(`${s}T00:00:00Z`);
    return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s ? s : "";
};

/** A scanned report, read by Gemini as text, matched back to real people; `filled` lists the fields it set. */
export function matchReadIntake(read: unknown, clients: { id: string; name: string }[], crew: { id: string; name: string }[], today: string): { intake: Intake; filled: (keyof Intake)[] } {
    const intake = emptyIntake(today);
    const filled: (keyof Intake)[] = [];
    if (!read || typeof read !== "object")
        return { intake, filled };
    const r = read as Record<string, unknown>;
    const set = <K extends keyof Intake>(key: K, value: Intake[K], ok: boolean) => {
        if (ok) {
            intake[key] = value;
            filled.push(key);
        }
    };
    const title = typeof r.title === "string" ? r.title.trim().replace(/\s+/g, " ") : "";
    set("title", title, Boolean(title));
    const client = clients.find((c) => norm(c.name) === norm(r.clientName));
    set("clientId", client?.id ?? "", Boolean(client));
    const team = (Array.isArray(r.teamNames) ? r.teamNames : []).map((n) => crew.find((c) => norm(c.name) === norm(n))?.id).filter((id): id is string => Boolean(id));
    set("team", [...new Set(team)], team.length > 0);
    set("startDate", isoDate(r.startDate), Boolean(isoDate(r.startDate)));
    set("endDate", isoDate(r.endDate), Boolean(isoDate(r.endDate)));
    const areas = (Array.isArray(r.areas) ? r.areas : []).map((a): ScopeArea => {
        const o = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
        const work = (Array.isArray(o.work) ? o.work : []).map((w) => WORK_TYPES.find((t) => norm(t) === norm(w))).filter((w): w is (typeof WORK_TYPES)[number] => Boolean(w));
        const sqm = Number(o.sqm);
        return { name: typeof o.name === "string" ? o.name.trim() : "", work, sqm: o.sqm != null && Number.isFinite(sqm) && sqm > 0 ? sqm : null, notes: typeof o.notes === "string" ? o.notes.trim() : "" };
    }).filter((a) => a.name || a.work.length > 0);
    set("areas", areas, areas.length > 0);
    const weekdays = [...new Set((Array.isArray(r.workingDays) ? r.workingDays : []).map((d) => DAY_NAMES.findIndex((n) => norm(d).length >= 3 && n.toLowerCase().startsWith(norm(d).slice(0, 3)))).filter((d) => d >= 0))].sort();
    set("weekdays", weekdays, weekdays.length > 0);
    const offDates = (Array.isArray(r.offDates) ? r.offDates : []).map(isoDate).filter(Boolean);
    set("offDates", offDates, offDates.length > 0);
    const notes = typeof r.notes === "string" ? r.notes.trim() : "";
    set("notes", notes, Boolean(notes));
    return { intake, filled };
}

/** Vercel refuses request bodies over 4.5 MB, so uploads stop at 4 MB. */
export const MAX_REPORT_UPLOAD_BYTES = 4 * 1024 * 1024;
export const REPORT_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const isStr = (v: unknown): v is string => typeof v === "string";
const dateOrBlank = (v: unknown) => isStr(v) && (v === "" || isoDate(v) === v);

/** A report sent by the browser, checked field by field; null when any field has the wrong shape. */
export function asIntake(raw: unknown): Intake | null {
    if (!raw || typeof raw !== "object")
        return null;
    const r = raw as Record<string, unknown>;
    const site = r.site as { lat?: unknown; lng?: unknown } | null;
    const siteOk = site === null || (site && typeof site === "object" && typeof site.lat === "number" && typeof site.lng === "number" && Math.abs(site.lat) <= 90 && Math.abs(site.lng) <= 180);
    const areasOk = Array.isArray(r.areas) && r.areas.length <= 30 && r.areas.every((a) => a && typeof a === "object" && isStr(a.name) && Array.isArray(a.work) && a.work.every(isStr) && (a.sqm === null || typeof a.sqm === "number") && isStr(a.notes));
    if (!isStr(r.title) || !isStr(r.clientId) || !siteOk || !dateOrBlank(r.startDate) || !dateOrBlank(r.endDate)
        || !Array.isArray(r.team) || !r.team.every(isStr) || !areasOk
        || !Array.isArray(r.weekdays) || !r.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        || !Array.isArray(r.offDates) || !r.offDates.every((d) => isoDate(d) === d) || !isStr(r.notes))
        return null;
    return {
        title: r.title.slice(0, 160),
        clientId: r.clientId,
        site: site ? { lat: site.lat as number, lng: site.lng as number } : null,
        startDate: r.startDate as string,
        endDate: r.endDate as string,
        team: [...new Set(r.team as string[])],
        areas: (r.areas as ScopeArea[]).map((a) => ({ name: a.name.slice(0, 80), work: a.work.filter((w) => (WORK_TYPES as readonly string[]).includes(w)), sqm: a.sqm, notes: a.notes.slice(0, 600) })),
        weekdays: [...new Set(r.weekdays as number[])],
        offDates: [...new Set(r.offDates as string[])],
        notes: r.notes.slice(0, 2000),
    };
}

export const TOO_SHORT = "The dates are too short for this scope.";
