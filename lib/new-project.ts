import { addDays, daysBetween, formatDate, plural } from "./dashboard.ts";

/**
 * Wording and checks behind the New project form. Pure, so `node --test`
 * can run it. Dates are ISO calendar dates (YYYY-MM-DD).
 */

export const addWeeks = (iso: string, weeks: number) => addDays(iso, weeks * 7);

/** "8 weeks", "8 weeks 3 days", "5 days", "Same day"; null until both dates are set and in order. */
export function spanPhrase(startDate: string, endDate: string): string | null {
    if (!startDate || !endDate || endDate < startDate)
        return null;
    const days = daysBetween(startDate, endDate);
    if (days === 0)
        return "Same day";
    const weeks = Math.floor(days / 7), rest = days % 7;
    return [weeks ? plural(weeks, "week") : "", rest ? plural(rest, "day") : ""].filter(Boolean).join(" ");
}

export function endDateError(startDate: string, endDate: string): string | null {
    if (!startDate || !endDate || endDate >= startDate)
        return null;
    return `The end date is before the start date. Pick ${formatDate(startDate, { month: "short", day: "numeric" })} or later.`;
}

export type NewProjectDraft = { title: string; clientId: string; middlemanId: string; startDate: string; endDate: string };

/** "Add a title, a client and an end date", or null when nothing required is missing. */
export function missingPhrase(d: NewProjectDraft): string | null {
    const missing = [
        !d.title.trim() && "a title",
        !d.clientId && "a client",
        !d.middlemanId && "a middleman",
        !d.startDate && "a start date",
        !d.endDate && "an end date",
    ].filter((m): m is string => Boolean(m));
    if (missing.length === 0)
        return null;
    return `Add ${missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}` : missing[0]}`;
}

type PmProject = { id: string; client_id: string; status: string };

/** How this PM knows a client: projects together, all time. */
export function clientContext(clientId: string, projects: PmProject[]): string {
    const n = projects.filter((p) => p.client_id === clientId).length;
    return n > 0 ? `Client on ${n} of your projects` : "New to you";
}

/** How busy a middleman is on this PM's active projects, as a member or an invitee still to answer. */
export function crewContext(userId: string, projects: PmProject[], members: { project_id: string; user_id: string }[], invites: { project_id: string; invitee_id: string }[]): string {
    const active = new Set(projects.filter((p) => p.status !== "completed").map((p) => p.id));
    const on = new Set([
        ...members.filter((m) => m.user_id === userId).map((m) => m.project_id),
        ...invites.filter((i) => i.invitee_id === userId).map((i) => i.project_id),
    ].filter((id) => active.has(id)));
    return on.size > 0 ? `On ${on.size} of your active projects` : "Not on your active projects";
}
