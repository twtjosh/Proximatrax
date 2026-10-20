"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Inbox, Mail, Search, X } from "lucide-react";
import { toast } from "sonner";
import { markInquiryViewedAction, updateInquiryAction } from "@/app/(dashboard)/inquiries/actions";
import { focusRing, primaryAction, softAction, stagger } from "@/components/dashboard/overview-kit";
import { ROUTES } from "@/lib/constants";
import { BUSINESS_TIME_ZONE, daysBetween, isoDateIn, plural } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import type { Inquiry, InquiryStatus } from "@/types/database";

/** Where an inquiry stands. "Became a project" is the name the Overview counts. */
const STATUS: Record<InquiryStatus, { label: string; chip: string; hint: string }> = {
    new: { label: "New", chip: "bg-brand-soft text-brand", hint: "Not answered yet" },
    contacted: { label: "Contacted", chip: "bg-info-soft text-info", hint: "You have replied" },
    converted: { label: "Became a project", chip: "bg-success-soft text-success", hint: "They signed on" },
    closed: { label: "Closed", chip: "bg-neutral-soft text-neutral", hint: "Nothing more to do" },
};
const ORDER: InquiryStatus[] = ["new", "contacted", "converted", "closed"];
type Filter = InquiryStatus | "all";

const clock = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { ...opts, timeZone: BUSINESS_TIME_ZONE }).format(new Date(iso));

/** List time: "3:42 PM" today, "Yesterday", a weekday this week, then the date. */
function listWhen(iso: string, today: string) {
    const days = daysBetween(isoDateIn(iso), today);
    if (days <= 0)
        return clock(iso, { hour: "numeric", minute: "2-digit" });
    if (days === 1)
        return "Yesterday";
    if (days < 7)
        return clock(iso, { weekday: "short" });
    return clock(iso, iso.slice(0, 4) === today.slice(0, 4) ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts.length === 0 ? "?" : parts.length === 1 ? parts[0]!.slice(0, 2).toUpperCase() : `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

function StatusChip({ status, className }: { status: InquiryStatus; className?: string }) {
    return <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11.5px] font-medium whitespace-nowrap", STATUS[status].chip, className)}>{STATUS[status].label}</span>;
}

export function InquiryInbox({ inquiries, viewedInquiryIds, openInquiryId }: {
    inquiries: Inquiry[];
    viewedInquiryIds: string[];
    openInquiryId?: string;
}) {
    const router = useRouter();
    const [today] = React.useState(() => isoDateIn(new Date()));
    const [seen, setSeen] = React.useState(() => new Set(viewedInquiryIds));
    // Status and notes saved here show at once; the server copy catches up on refresh.
    const [saved, setSaved] = React.useState<Record<string, Pick<Inquiry, "status" | "notes">>>({});
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [filter, setFilter] = React.useState<Filter>("all");
    const [query, setQuery] = React.useState("");
    const searchRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLUListElement>(null);

    const rows = React.useMemo(() => inquiries
        .map((r) => (saved[r.id] ? { ...r, ...saved[r.id] } : r))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)), [inquiries, saved]);
    const counts = React.useMemo(() => {
        const c: Record<Filter, number> = { all: rows.length, new: 0, contacted: 0, converted: 0, closed: 0 };
        for (const r of rows)
            c[r.status]++;
        return c;
    }, [rows]);
    const q = query.trim().toLowerCase();
    const shown = rows.filter((r) => (filter === "all" || r.status === filter) &&
        (!q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.message.toLowerCase().includes(q)));
    const selected = rows.find((r) => r.id === selectedId) ?? null;
    const unread = rows.filter((r) => !seen.has(r.id)).length;

    const select = React.useCallback((row: Inquiry) => {
        setSelectedId(row.id);
        if (seen.has(row.id))
            return;
        setSeen((prev) => new Set(prev).add(row.id));
        void markInquiryViewedAction(row.id).then((res) => {
            if (!res.ok) {
                toast.error(res.error);
                setSeen((prev) => {
                    const next = new Set(prev);
                    next.delete(row.id);
                    return next;
                });
                return;
            }
            router.refresh();
        });
    }, [router, seen]);

    // Deep links: ?open=<id> from notifications, #<id> from the shell.
    React.useEffect(() => {
        const id = openInquiryId ?? window.location.hash.slice(1);
        if (!id)
            return;
        const row = inquiries.find((r) => r.id === id);
        if (row) {
            select(row);
            requestAnimationFrame(() => document.getElementById(`inquiry-${id}`)?.scrollIntoView({ block: "nearest" }));
        }
        if (openInquiryId)
            router.replace(ROUTES.INQUIRIES, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once per incoming link
    }, [openInquiryId]);

    // "/" jumps to search, as in most inboxes.
    React.useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const t = e.target as HTMLElement;
            if (e.key !== "/" || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
                return;
            e.preventDefault();
            searchRef.current?.focus();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    /** Arrow keys walk the list; Enter or Space opens the focused row. */
    function onListKey(e: React.KeyboardEvent) {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp")
            return;
        const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-row]") ?? [])];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = buttons[Math.min(Math.max(at + (e.key === "ArrowDown" ? 1 : -1), 0), buttons.length - 1)];
        if (next) {
            e.preventDefault();
            next.focus();
        }
    }

    async function save(row: Inquiry, status: InquiryStatus, notes: string) {
        const before = saved[row.id];
        setSaved((prev) => ({ ...prev, [row.id]: { status, notes: notes.trim() || null } }));
        const res = await updateInquiryAction(row.id, status, notes);
        if (!res.ok) {
            setSaved((prev) => {
                const next = { ...prev };
                if (before)
                    next[row.id] = before;
                else
                    delete next[row.id];
                return next;
            });
            toast.error(`Couldn't save: ${res.error}`);
            return false;
        }
        router.refresh();
        return true;
    }

    const sub = unread > 0
        ? <><b>{unread} unread</b>{counts.new > 0 ? <> · {plural(counts.new, "inquiry")} not answered yet</> : null}</>
        : counts.new > 0 ? <>All read · <b>{counts.new} not answered yet</b></> : "All read and answered";

    return (<div className="mx-auto w-full max-w-360 pb-10">
      <header className="materialize flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-ink sm:text-[2.5rem]">Inquiries</h1>
          <p className="mt-2 text-[15px] text-ink-tertiary [&_b]:font-medium [&_b]:text-ink">{sub}</p>
        </div>
        <p className="hidden text-[13px] text-ink-tertiary lg:block">From the “Get in touch” form on the public site</p>
      </header>

      <div className="materialize mt-6 grid overflow-hidden rounded-[20px] material lg:h-[min(48rem,calc(100dvh-12rem))] lg:min-h-[30rem] lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]" style={stagger(1)}>
        {/* List */}
        <section aria-label="Inquiry list" className={cn("flex min-h-0 flex-col lg:border-r lg:border-line", selected && "max-lg:hidden")}>
          <div className="space-y-3 border-b border-line p-3 sm:p-4">
            <label className="relative block">
              <span className="sr-only">Search inquiries</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-tertiary" aria-hidden/>
              <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or message" className="h-10 w-full rounded-full border-0 bg-surface-sunken pr-9 pl-9 text-sm text-ink transition-shadow outline-none placeholder:text-ink-tertiary focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-brand/40 [&::-webkit-search-cancel-button]:hidden"/>
              {query ? (<button type="button" onClick={() => { setQuery(""); searchRef.current?.focus(); }} aria-label="Clear search" className={cn("absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-tertiary hover:bg-line hover:text-ink", focusRing)}>
                  <X className="size-3.5" aria-hidden/>
                </button>) : (<kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line-strong px-1.5 font-sans text-[11px] leading-4 text-ink-tertiary sm:block">/</kbd>)}
            </label>
            <div role="radiogroup" aria-label="Show" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
              {(["all", ...ORDER] as Filter[]).map((f) => {
                const on = filter === f;
                return (<button key={f} type="button" role="radio" aria-checked={on} onClick={() => setFilter(f)} className={cn("press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-colors", focusRing, on ? "bg-ink text-white" : "text-ink-secondary hover:bg-surface-sunken hover:text-ink")}>
                    {f === "all" ? "All" : STATUS[f].label}
                    <span className={cn("tabular text-[12px]", on ? "text-white/65" : "text-ink-tertiary")}>{counts[f]}</span>
                  </button>);
            })}
            </div>
          </div>

          {shown.length === 0 ? (<div className="grid flex-1 place-content-center px-6 py-14 text-center">
              <p className="text-[15px] font-medium text-ink">{q ? `Nothing matches “${query.trim()}”` : `No ${STATUS[filter as InquiryStatus].label.toLowerCase()} inquiries`}</p>
              <button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className={cn("mx-auto mt-3", softAction)}>Show all inquiries</button>
            </div>) : (<ul ref={listRef} onKeyDown={onListKey} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 sm:p-2">
              {shown.map((r) => {
                const isUnread = !seen.has(r.id);
                const on = r.id === selectedId;
                return (<li key={r.id}>
                    <button type="button" data-row id={`inquiry-${r.id}`} onClick={() => select(r)} aria-current={on ? "true" : undefined} className={cn("group relative flex w-full gap-3 rounded-[14px] px-3 py-3 text-left transition-colors duration-200", focusRing, "focus-visible:ring-offset-0", on ? "bg-brand-soft" : "hover:bg-surface-subtle")}>
                      <span className={cn("relative mt-0.5 grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold", on || isUnread ? "bg-surface text-ink shadow-[0_0_0_1px_var(--line)]" : "bg-surface-sunken text-ink-tertiary")} aria-hidden>
                        {initials(r.name)}
                        {isUnread ? <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-copper ring-2 ring-surface"/> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className={cn("min-w-0 flex-1 truncate text-[14.5px]", isUnread ? "font-semibold text-ink" : "font-medium text-ink-secondary")}>{r.name}</span>
                          <time dateTime={r.created_at} className={cn("shrink-0 text-[12px] tabular", isUnread ? "font-medium text-brand" : "text-ink-tertiary")}>{listWhen(r.created_at, today)}</time>
                        </span>
                        <span className={cn("mt-0.5 line-clamp-2 text-[13px] leading-snug", isUnread ? "text-ink-secondary" : "text-ink-tertiary")}>{r.message}</span>
                        {r.status !== "new" ? <StatusChip status={r.status} className="mt-2"/> : null}
                      </span>
                      <span className="sr-only">{isUnread ? "Unread. " : ""}{STATUS[r.status].label}</span>
                    </button>
                  </li>);
            })}
            </ul>)}
        </section>

        {/* Reader */}
        <section aria-label="Inquiry" className={cn("min-h-0 bg-surface/60", !selected && "max-lg:hidden")}>
          {selected
            ? <Reader key={selected.id} row={selected} today={today} onBack={() => setSelectedId(null)} onSave={save}/>
            : (<div className="grid h-full place-content-center px-8 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-brand"><Inbox className="size-6" strokeWidth={1.75} aria-hidden/></span>
                <p className="mt-4 text-[15px] font-medium text-ink">Choose an inquiry to read it</p>
                <p className="mt-1 text-[13px] text-ink-tertiary">A copper dot marks the ones you haven’t opened. Use ↑ ↓ to move through the list.</p>
              </div>)}
        </section>
      </div>
    </div>);
}

function Reader({ row, today, onBack, onSave }: {
    row: Inquiry;
    today: string;
    onBack: () => void;
    onSave: (row: Inquiry, status: InquiryStatus, notes: string) => Promise<boolean>;
}) {
    const [notes, setNotes] = React.useState(row.notes ?? "");
    const [pending, startTransition] = React.useTransition();
    const notesDirty = notes.trim() !== (row.notes ?? "").trim();
    const days = daysBetween(isoDateIn(row.created_at), today);
    const quoted = row.message.slice(0, 1500).split("\n").map((l) => `> ${l}`).join("\n");
    const mailto = `mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent("Re: your inquiry to ProximaTrax")}&body=${encodeURIComponent(`Hi ${row.name.split(" ")[0]},\n\n\n\n${quoted}`)}`;

    function setStatus(status: InquiryStatus) {
        if (status === row.status)
            return;
        startTransition(async () => {
            if (await onSave(row, status, row.notes ?? ""))
                toast.success(`Marked as ${STATUS[status].label.toLowerCase()}`);
        });
    }

    function saveNotes() {
        startTransition(async () => {
            if (await onSave(row, row.status, notes))
                toast.success("Note saved");
        });
    }

    function copyEmail() {
        void navigator.clipboard.writeText(row.email).then(() => toast.success("Email copied"), () => toast.error("Couldn't copy the email"));
    }

    function afterReply() {
        // The mail app opens outside the page, so offer the next step rather than assume the reply went out.
        if (row.status === "new")
            toast("Did you reply?", { action: { label: "Mark contacted", onClick: () => setStatus("contacted") } });
    }

    return (<article className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-[44rem] px-5 pt-4 pb-8 sm:px-8 sm:pt-7">
          <button type="button" onClick={onBack} className={cn("-ml-2 mb-4 inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-ink-secondary hover:bg-surface-sunken hover:text-ink lg:hidden", focusRing)}>
            <ArrowLeft className="size-4" aria-hidden/>
            Inquiries
          </button>

          <header className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-soft text-[15px] font-semibold text-brand" aria-hidden>{initials(row.name)}</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.022em] text-ink sm:text-[26px]">{row.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-1 text-[14px]">
                <a href={`mailto:${encodeURIComponent(row.email)}`} className={cn("min-w-0 truncate rounded-sm font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand", focusRing)}>{row.email}</a>
                <button type="button" onClick={copyEmail} aria-label="Copy email address" className={cn("grid size-8 place-items-center rounded-full text-ink-tertiary hover:bg-surface-sunken hover:text-ink", focusRing)}>
                  <Copy className="size-3.5" aria-hidden/>
                </button>
              </div>
              <p className="mt-0.5 text-[13px] text-ink-tertiary">
                Received <time dateTime={row.created_at}>{clock(row.created_at, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
                {days > 0 ? <> · {days === 1 ? "yesterday" : `${days} days ago`}</> : null}
              </p>
            </div>
          </header>

          <div className="mt-6 rounded-[16px] bg-surface p-5 shadow-[0_0_0_1px_var(--line)] sm:p-6">
            <p className="text-[15px] leading-[1.65] whitespace-pre-wrap text-ink">{row.message}</p>
          </div>

          <fieldset className="mt-8" disabled={pending}>
            <legend className="text-[13px] font-semibold text-ink">Where it stands</legend>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ORDER.map((s) => {
                const on = row.status === s;
                return (<label key={s} className={cn("press relative flex cursor-pointer flex-col rounded-[12px] px-3 py-2.5 transition-[box-shadow,background-color] duration-200 has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2", on ? "bg-surface shadow-[0_0_0_1.5px_var(--brand),0_6px_16px_-10px_rgb(180_83_9/0.5)]" : "bg-surface-sunken/70 hover:bg-surface-sunken")}>
                    <input type="radio" name={`status-${row.id}`} value={s} checked={on} onChange={() => setStatus(s)} className="sr-only"/>
                    <span className={cn("text-[13.5px] font-semibold", on ? "text-ink" : "text-ink-secondary")}>{STATUS[s].label}</span>
                    <span className="mt-0.5 text-[12px] text-ink-tertiary">{STATUS[s].hint}</span>
                  </label>);
            })}
            </div>
          </fieldset>

          <div className="mt-8">
            <label htmlFor={`notes-${row.id}`} className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-semibold text-ink">Internal note</span>
              <span className="text-[12px] text-ink-tertiary">Only super admins see this</span>
            </label>
            <textarea id={`notes-${row.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={pending} rows={3} placeholder="Budget, rooms, when they called back…" className="mt-2 field-sizing-content min-h-24 w-full resize-none rounded-[12px] border border-line bg-surface px-3.5 py-3 text-[14px] leading-relaxed text-ink transition-[border-color,box-shadow] outline-none placeholder:text-ink-tertiary hover:border-line-strong focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20 disabled:opacity-60"/>
            {notesDirty ? (<div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setNotes(row.notes ?? "")} disabled={pending} className={cn("h-8 rounded-full px-3.5 text-[13px] font-medium text-ink-secondary hover:bg-surface-sunken hover:text-ink", focusRing)}>Discard</button>
                <button type="button" onClick={saveNotes} disabled={pending} className={cn(softAction, "bg-ink text-white hover:bg-ink/85")}>{pending ? "Saving…" : "Save note"}</button>
              </div>) : null}
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-surface/80 px-5 py-3 backdrop-blur-sm sm:px-8">
        <StatusChip status={row.status}/>
        <a href={mailto} onClick={afterReply} className={primaryAction}>
          <Mail aria-hidden/>
          Reply by email
        </a>
      </footer>
    </article>);
}
