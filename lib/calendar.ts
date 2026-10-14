/**
 * Calendar helpers for the client's "Dates to know": a month as weeks, month
 * stepping, a downloadable all-day event, and the start of a question to the
 * project manager. Pure, so `node --test` can run them.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** A month ("YYYY-MM") as Sunday-first weeks of ISO dates, padded with nulls. */
export function monthGrid(month: string): (string | null)[][] {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: (string | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`)];
    while (cells.length % 7 !== 0)
        cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** "2026-12" plus 1 is "2027-01". */
export function addMonths(month: string, n: number): string {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** An all-day calendar event (RFC 5545) a phone or desktop calendar can import. */
export function buildIcs({ uid, title, date, description, stamp }: {
    uid: string;
    title: string;
    /** ISO date (YYYY-MM-DD) of the day. */
    date: string;
    description: string;
    /** ISO instant the file was made. */
    stamp: string;
}): string {
    const day = (iso: string) => iso.replace(/-/g, "");
    const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//ProximaTrax//Project dates//EN",
        "BEGIN:VEVENT",
        `UID:${uid}@proximatrax`,
        `DTSTAMP:${stamp.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`,
        `DTSTART;VALUE=DATE:${day(date)}`,
        `DTEND;VALUE=DATE:${day(next)}`,
        `SUMMARY:${escape(title)}`,
        `DESCRIPTION:${escape(description)}`,
        "END:VEVENT",
        "END:VCALENDAR",
        "",
    ].join("\r\n");
}

/** The chat draft for a question about `subject`, keeping anything already typed. */
export function askDraft(subject: string, current: string): string {
    const lead = `About ${subject}: `;
    return current.startsWith(lead) ? current : `${lead}${current}`;
}
