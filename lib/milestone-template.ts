/**
 * The standard lifecycle a new project can start with. The form previews
 * these dates and the server seeds the same ones, so both use this one rule:
 * milestone i lands at (i + 1) / 5 of the way from start to end.
 * No imports, so `node --test` can run it.
 */
export const DEFAULT_LIFECYCLE_TEMPLATE = [
    "Site Survey",
    "Design Approval",
    "Site Preparation",
    "Construction",
    "Handover",
] as const;

/** The template's milestones with their due dates, or null when the range is missing or backwards. */
export function templateMilestones(startDate: string, endDate: string): { title: string; due_date: string }[] | null {
    if (!startDate || !endDate)
        return null;
    const start = Date.parse(`${startDate}T00:00:00Z`);
    const span = Date.parse(`${endDate}T00:00:00Z`) - start;
    if (Number.isNaN(span) || span < 0)
        return null;
    return DEFAULT_LIFECYCLE_TEMPLATE.map((title, i) => ({
        title,
        due_date: new Date(start + ((i + 1) / DEFAULT_LIFECYCLE_TEMPLATE.length) * span).toISOString().slice(0, 10),
    }));
}
