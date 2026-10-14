import { addDays, formatDate } from "./dashboard.ts";

/**
 * One line of text into a task: `@person`, `#milestone` and a day word come
 * out of the title as chips. Unknown names stay in the title, so nothing the
 * PM typed is lost. Pure, so `node --test` can run it.
 */
export type QuickAddToken = { kind: "person" | "milestone" | "date"; text: string; label: string };
export type ParsedTask = { title: string; assigneeId: string | null; milestoneId: string | null; dueDate: string | null; tokens: QuickAddToken[] };

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** "fri", "frid" and "friday" all name Friday; three letters at least. */
const named = (names: string[], w: string) => (w.length >= 3 ? names.findIndex((n) => n.startsWith(w)) : -1);
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const pad = (n: number) => String(n).padStart(2, "0");

/** This year's month/day, or next year's once it has passed. */
function nextDate(month: number, day: number, today: string): string | null {
    if (month < 1 || month > 12 || day < 1 || day > 31)
        return null;
    let y = Number(today.slice(0, 4));
    let iso = `${y}-${pad(month)}-${pad(day)}`;
    if (iso < today)
        iso = `${++y}-${pad(month)}-${pad(day)}`;
    return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** A day word at tokens[i] (and maybe tokens[i + 1]): the date and how many tokens it used. */
function readDate(tokens: string[], i: number, today: string): { date: string; used: number } | null {
    const w = tokens[i].toLowerCase();
    if (w === "today")
        return { date: today, used: 1 };
    if (w === "tomorrow" || w === "tmr" || w === "tmrw")
        return { date: addDays(today, 1), used: 1 };
    const weekday = named(WEEKDAYS, w);
    if (weekday >= 0) {
        const now = new Date(`${today}T00:00:00Z`).getUTCDay();
        return { date: addDays(today, ((weekday - now + 7) % 7) || 7), used: 1 };
    }
    let m = w.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m && !Number.isNaN(Date.parse(w)))
        return { date: w, used: 1 };
    m = w.match(/^(\d{1,2})[/-](\d{1,2})$/);
    if (m) {
        const date = nextDate(Number(m[1]), Number(m[2]), today);
        return date ? { date, used: 1 } : null;
    }
    const month = named(MONTHS, w.replace(/\.$/, ""));
    const day = tokens[i + 1]?.match(/^(\d{1,2})(st|nd|rd|th)?$/);
    if (month >= 0 && day) {
        const date = nextDate(month + 1, Number(day[1]), today);
        return date ? { date, used: 2 } : null;
    }
    return null;
}

export function parseQuickAdd(input: string, { people, milestones, today }: {
    people: { id: string; name: string }[];
    milestones: { id: string; title: string }[];
    /** ISO date (Manila). */
    today: string;
}): ParsedTask {
    const words = input.trim().split(/\s+/).filter(Boolean);
    const title: string[] = [];
    const tokens: QuickAddToken[] = [];
    let assigneeId: string | null = null;
    let milestoneId: string | null = null;
    let dueDate: string | null = null;
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (w.startsWith("@") && w.length > 1 && !assigneeId) {
            const q = w.slice(1).toLowerCase();
            const person = people.find((p) => p.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(q)) || squash(p.name).startsWith(squash(q)));
            if (person) {
                assigneeId = person.id;
                tokens.push({ kind: "person", text: w, label: person.name });
                continue;
            }
        }
        if (w.startsWith("#") && w.length > 1 && !milestoneId) {
            const q = squash(w.slice(1));
            const milestone = q ? milestones.find((m) => squash(m.title).startsWith(q)) : undefined;
            if (milestone) {
                milestoneId = milestone.id;
                tokens.push({ kind: "milestone", text: w, label: milestone.title });
                continue;
            }
        }
        if (!dueDate) {
            const read = readDate(words, i, today);
            if (read) {
                dueDate = read.date;
                tokens.push({ kind: "date", text: words.slice(i, i + read.used).join(" "), label: formatDate(read.date, { weekday: "short", month: "short", day: "numeric" }) });
                i += read.used - 1;
                continue;
            }
        }
        title.push(w);
    }
    return { title: title.join(" "), assigneeId, milestoneId, dueDate, tokens };
}
