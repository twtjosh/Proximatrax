import type { InquiryStatus } from "@/types/database";
export type InquiryTriageRow = {
    id: string;
    status: InquiryStatus;
    name: string;
    email: string;
    created_at: string;
};
export function openedSet(openedIds: Iterable<string>): Set<string> {
    return new Set(openedIds);
}
export function triageCounts(rows: InquiryTriageRow[], openedIds: Iterable<string>) {
    const opened = openedSet(openedIds);
    const unopened = rows.filter((r) => !opened.has(r.id));
    return {
        totalUnopened: unopened.length,
        newUnopened: unopened.filter((r) => r.status === "new").length,
    };
}
export function partitionByOpened(rows: InquiryTriageRow[], openedIds: Iterable<string>) {
    const opened = openedSet(openedIds);
    const unread = rows.filter((r) => !opened.has(r.id));
    const read = rows.filter((r) => opened.has(r.id));
    return { unread, read };
}
export function sortByCreatedDesc<T extends {
    created_at: string;
}>(rows: T[]): T[] {
    return [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
