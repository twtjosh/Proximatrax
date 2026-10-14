import { ROLE_TERMS } from "./vocabulary.ts";

/**
 * Who is carrying what on a project: the PM and client first, then the crew
 * busiest first. Late is the person's own lateness; work waiting on the PM
 * is counted as in review, not late. Pure, so `node --test` can run it.
 */
export type PersonLoad<P> = P & { open: number; late: number; review: number };

export function peopleLoad<P extends { id: string; name: string; role: string }>(team: P[], tasks: { assigned_to: string | null; stage: string; due_date: string | null }[], today: string): PersonLoad<P>[] {
    const withLoad = team.map((p) => {
        const mine = tasks.filter((t) => t.assigned_to === p.id && t.stage !== "done");
        return {
            ...p,
            open: mine.length,
            late: mine.filter((t) => t.stage !== "review" && t.due_date !== null && t.due_date < today).length,
            review: mine.filter((t) => t.stage === "review").length,
        };
    });
    const rank = (role: string) => (role === ROLE_TERMS.project_manager ? 0 : role === ROLE_TERMS.client ? 1 : 2);
    return withLoad.sort((a, b) => rank(a.role) - rank(b.role) || b.open - a.open || b.late - a.late || a.name.localeCompare(b.name));
}
