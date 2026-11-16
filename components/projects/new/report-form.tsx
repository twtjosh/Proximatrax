"use client";
import * as React from "react";
import Link from "next/link";
import { AlertCircle, Check, ChevronLeft, FileText, FileUp, Loader2, MapPin, Plus, Printer, Sparkles, X } from "lucide-react";
import { focusRing, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { PersonPicker, type PersonOption } from "@/components/projects/new/person-picker";
import { PlanReview } from "@/components/projects/new/plan-review";
import { LINE, ScopeAreas } from "@/components/projects/new/scope-areas";
import { TeamCards, type CrewOption } from "@/components/projects/new/team-cards";
import { SitePicker } from "@/components/projects/pm/site-picker";
import { workingDays, type PlannedMilestone } from "@/lib/auto-plan";
import { ROUTES } from "@/lib/constants";
import { formatDate, plural } from "@/lib/dashboard";
import { endDateError, spanPhrase } from "@/lib/new-project";
import { BUSY_MESSAGE } from "@/lib/gemini";
import { asIntake, emptyIntake, intakeCalendar, intakeMissing, MAX_REPORT_UPLOAD_BYTES, REPORT_UPLOAD_TYPES, type Intake } from "@/lib/project-intake";
import { cn, getErrorMessage } from "@/lib/utils";

const DRAFT_KEY = "intake-draft";
const WEEKDAYS = [["S", "Sunday"], ["M", "Monday"], ["T", "Tuesday"], ["W", "Wednesday"], ["T", "Thursday"], ["F", "Friday"], ["S", "Saturday"]] as const;
const READ_MARK = "rounded-lg bg-brand-soft/60 ring-4 ring-brand-soft/60 print:bg-transparent print:ring-0";
const LABEL = "text-[11px] font-semibold tracking-[0.08em] text-ink-tertiary uppercase";
/** What the field names mean to a PM, for the "read from your file" summary. */
const FIELD_NAMES: Partial<Record<keyof Intake, string>> = { title: "title", clientId: "client", startDate: "start date", endDate: "handover date", areas: "scope of work", weekdays: "working days", offDates: "days off", notes: "notes" };
const DRAFT_STEPS = ["Reading the scope of work", "Breaking it into milestones and tasks", "Placing every date on a working day", "Giving each task to the right person"];

function loadDraft(today: string): Intake {
    try {
        const saved = asIntake(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null"));
        if (saved)
            return saved;
    }
    catch {
        // No storage (private window, blocked): start blank.
    }
    return emptyIntake(today);
}
function clearDraft() {
    try {
        localStorage.removeItem(DRAFT_KEY);
    }
    catch {
        // Nothing to clear.
    }
}

/**
 * The project report: a paper form the PM fills during or right after the
 * client interview, or reads in from any project document they already have.
 * A rail beside it shows what is still missing; Save asks Gemini to draft
 * the plan for review.
 */
export function ReportForm({ today, pmName, clients, crew }: {
    today: string;
    pmName: string;
    clients: PersonOption[];
    crew: CrewOption[];
}) {
    const [intake, setIntake] = React.useState<Intake>(() => emptyIntake(today));
    const [filled, setFilled] = React.useState<Set<keyof Intake>>(new Set());
    const [readFrom, setReadFrom] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState<"read" | "plan" | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [plan, setPlan] = React.useState<PlannedMilestone[] | null>(null);
    const [siteOpen, setSiteOpen] = React.useState(false);
    const [offDate, setOffDate] = React.useState("");
    const [dragging, setDragging] = React.useState(false);
    const dragDepth = React.useRef(0);
    const fileRef = React.useRef<HTMLInputElement>(null);
    const loaded = React.useRef(false);

    // The draft lives in this browser until the plan is confirmed, so a refresh or a busy AI loses nothing.
    React.useEffect(() => {
        setIntake(loadDraft(today));
        loaded.current = true;
    }, [today]);
    React.useEffect(() => {
        if (!loaded.current)
            return;
        const t = setTimeout(() => {
            try {
                localStorage.setItem(DRAFT_KEY, JSON.stringify(intake));
            }
            catch {
                // Storage full or blocked: the form still works.
            }
        }, 400);
        return () => clearTimeout(t);
    }, [intake]);

    const set = <K extends keyof Intake>(key: K, value: Intake[K]) => setIntake((i) => ({ ...i, [key]: value }));
    const mark = (key: keyof Intake) => (filled.has(key) ? READ_MARK : "");
    const missing = intakeMissing(intake);
    const span = spanPhrase(intake.startDate, intake.endDate);
    const dateError = endDateError(intake.startDate, intake.endDate);
    const days = intake.startDate && intake.endDate && !dateError ? workingDays(intakeCalendar(intake)).length : 0;
    const day = (iso: string) => formatDate(iso, { month: "short", day: "numeric", year: "numeric" });
    const client = clients.find((c) => c.id === intake.clientId) ?? null;
    const scoped = intake.areas.filter((a) => a.name.trim() && a.work.length > 0);

    const steps: Step[] = [
        { id: "report-project", label: "Project", done: Boolean(intake.title.trim() && intake.clientId), value: intake.title.trim() ? `${intake.title.trim()}${client ? ` · ${client.name}` : ""}` : "Title and client" },
        { id: "report-schedule", label: "Schedule", done: Boolean(intake.startDate && intake.endDate && !dateError && intake.weekdays.length), value: span && !dateError ? `${span} · ${plural(days, "working day")}` : "Start and handover dates" },
        { id: "report-team", label: "Team", done: intake.team.length > 0, value: intake.team.length ? (intake.team.length === 1 ? "1 person" : `${intake.team.length} people`) : "Who works on it" },
        { id: "report-scope", label: "Scope of work", done: scoped.length > 0, value: scoped.length ? `${plural(scoped.length, "area")} · ${plural(scoped.reduce((n, a) => n + a.work.length, 0), "kind")} of work` : "Rooms and the work they need" },
    ];

    async function upload(file: File) {
        setError(null);
        if (!REPORT_UPLOAD_TYPES.includes(file.type))
            return setError("Use a PDF, JPG or PNG of the report.");
        if (file.size > MAX_REPORT_UPLOAD_BYTES)
            return setError("That file is over 4 MB. Save it smaller, or take the photo again at a lower size.");
        setBusy("read");
        setReadFrom(file.name);
        try {
            const body = new FormData();
            body.append("file", file);
            const res = await fetch("/api/project-report/read", { method: "POST", body });
            // A timed-out function answers with an HTML page, not JSON.
            const data = (await res.json().catch(() => ({ error: BUSY_MESSAGE }))) as { error?: string; intake?: Intake; filled?: (keyof Intake)[] };
            if (!res.ok || !data.intake)
                throw new Error(data.error ?? "The document could not be read.");
            const read = data.intake, keys = data.filled ?? [];
            setIntake((i) => ({ ...i, ...Object.fromEntries(keys.map((k) => [k, read[k]])) }));
            setFilled(new Set(keys));
            if (keys.length === 0) {
                setReadFrom(null);
                setError("Nothing about the project could be read from that file. Check it is the right document and clearly photographed.");
            }
        }
        catch (e) {
            setReadFrom(null);
            setError(getErrorMessage(e));
        }
        finally {
            setBusy(null);
        }
    }

    async function draftPlan() {
        if (missing || busy)
            return;
        setBusy("plan");
        setError(null);
        try {
            const res = await fetch("/api/project-report/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intake }) });
            const data = (await res.json().catch(() => ({ error: BUSY_MESSAGE }))) as { error?: string; plan?: PlannedMilestone[] };
            if (!res.ok || !data.plan)
                throw new Error(data.error ?? "The plan could not be made.");
            setPlan(data.plan);
            document.getElementById("report-top")?.scrollIntoView();
        }
        catch (e) {
            setError(getErrorMessage(e));
        }
        finally {
            setBusy(null);
        }
    }

    const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    const pickFile = () => fileRef.current?.click();
    const dropProps = {
        onDragEnter: (e: React.DragEvent) => {
            if (!e.dataTransfer.types.includes("Files") || busy)
                return;
            dragDepth.current++;
            setDragging(true);
        },
        onDragOver: (e: React.DragEvent) => {
            if (e.dataTransfer.types.includes("Files"))
                e.preventDefault();
        },
        onDragLeave: () => {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0)
                setDragging(false);
        },
        onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            dragDepth.current = 0;
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f && !busy)
                void upload(f);
        },
    };

    if (plan)
        return (<div id="report-top" className="relative">
        <PlanReview intake={intake} plan={plan} crew={crew} clientName={client?.name ?? ""} onBack={() => setPlan(null)} onRegenerate={draftPlan} regenerating={busy === "plan"} regenerateError={error} onConfirmed={clearDraft}/>
      </div>);

    const filledNames = [...filled].map((k) => FIELD_NAMES[k]).filter(Boolean) as string[];
    const save = (<button type="button" onClick={() => void draftPlan()} disabled={Boolean(missing) || busy !== null} className={cn(primaryAction, "h-11 w-full justify-center disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none")}>
        {busy === "plan" ? <Loader2 className="animate-spin" aria-hidden/> : <Sparkles aria-hidden/>}
        {busy === "plan" ? "Drafting the plan…" : "Save & draft the plan"}
      </button>);

    // `relative` keeps the screen-reader-only labels inside this screen; without it they size the page itself.
    return (<div id="report-top" className="relative mx-auto w-full max-w-[78rem] pb-10" {...dropProps}>
      <input ref={fileRef} type="file" accept={REPORT_UPLOAD_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }}/>

      <div data-print-hide>
        <Link href={ROUTES.PROJECTS} className={cn("inline-flex items-center gap-1 text-[13px] font-medium text-ink-tertiary hover:text-ink", focusRing)}>
          <ChevronLeft className="size-4" aria-hidden/>Projects
        </Link>
        <header className="materialize mt-2.5">
          <h1 className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-ink sm:text-[2.5rem]">New project</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-pretty text-ink-tertiary">Fill in the project report from the client interview, or start from a document you already have. The milestones, tasks, deadlines and who does what are drafted for you to check before anything is created.</p>
        </header>
      </div>

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          {readFrom && filled.size > 0 ? (<div role="status" data-print-hide className="materialize mb-5 flex items-start gap-3 rounded-2xl bg-brand-soft px-4 py-3.5 text-brand">
              <FileText className="mt-0.5 size-4.5 shrink-0" aria-hidden/>
              <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed">
                <b className="font-semibold break-all">{readFrom}</b> filled in the {filledNames.join(", ")}. Check the highlighted fields{intake.team.length === 0 ? ", then pick the team: it is never read from a document" : ""}.
              </p>
              <button type="button" onClick={() => { setFilled(new Set()); setReadFrom(null); }} aria-label="Hide highlights" className={cn("press -m-1 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-white/60", focusRing)}><X className="size-3.5" aria-hidden/></button>
            </div>) : null}
          {error ? (<p role="alert" data-print-hide className="mb-5 flex gap-2 rounded-2xl bg-danger-soft px-4 py-3.5 text-[13.5px] text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden/><span>{error}</span>
            </p>) : null}

          <div className="relative">
            <article aria-busy={busy !== null} className={cn("print-record materialize rounded-[6px] bg-surface px-6 py-8 text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06),0_18px_40px_-18px_rgb(60_40_20/0.35)] ring-1 ring-line transition-[opacity,filter] duration-300 [print-color-adjust:exact] sm:px-12 sm:py-11 print:rounded-none print:p-0 print:shadow-none print:ring-0", busy && "pointer-events-none opacity-55 blur-[1px] motion-reduce:blur-none")} style={{ "--i": 1 } as React.CSSProperties}>
              <header className="flex items-end justify-between gap-4 border-b-2 border-ink pb-4">
                <h2 className="text-2xl font-semibold tracking-[0.06em] uppercase sm:text-[1.7rem]">Project report</h2>
                <p className="shrink-0 text-right text-[12.5px] leading-snug text-ink-secondary">AEG Home Fashion<br/><span className="tabular">{day(today)}</span></p>
              </header>

              <Part id="report-project" title="Project">
                <label className={cn("block", mark("title"))}>
                  <span className={LABEL}>Project title</span>
                  <input value={intake.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Salcedo Residence kitchen and living room" maxLength={160} className={cn(LINE, "mt-1 text-lg font-medium")}/>
                </label>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div className={mark("clientId")}>
                    <PersonPicker id="client" label="Client" noun="client" people={clients} value={intake.clientId} onChange={(id) => set("clientId", id)} help="Sees the milestones and photos you approve."/>
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-ink">Site</span>
                    <button type="button" onClick={() => setSiteOpen(true)} className={cn("mt-1.5 flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-left transition-colors hover:border-ink-tertiary/50 print:border-0 print:border-b print:border-dashed print:px-0", focusRing)}>
                      <MapPin className="size-4 shrink-0 text-copper" aria-hidden/>
                      <span className={cn("min-w-0 truncate text-[14px]", intake.site ? "text-ink tabular" : "text-ink-tertiary")}>{intake.site ? `${intake.site.lat.toFixed(5)}, ${intake.site.lng.toFixed(5)}` : "Pick the site on the map"}</span>
                      {!intake.site ? <span className="ml-auto shrink-0 text-xs text-ink-tertiary" data-print-hide>Optional</span> : null}
                    </button>
                    <p className="mt-1.5 text-xs text-ink-tertiary" data-print-hide>Site photos are checked against this pin.</p>
                  </div>
                </div>
              </Part>

              <Part id="report-schedule" title="Schedule">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className={cn("block", mark("startDate"))}>
                    <span className={LABEL}>Start date</span>
                    <input type="date" value={intake.startDate} onChange={(e) => set("startDate", e.target.value)} className={cn(LINE, "mt-1 tabular")}/>
                  </label>
                  <label className={cn("block", mark("endDate"))}>
                    <span className={LABEL}>Handover date</span>
                    <input type="date" value={intake.endDate} min={intake.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} aria-invalid={Boolean(dateError)} aria-describedby="span-note" className={cn(LINE, "mt-1 tabular aria-invalid:border-danger")}/>
                  </label>
                </div>
                <p id="span-note" className="mt-2 min-h-5 text-[13px]" aria-live="polite">{dateError ? <span className="text-danger">{dateError}</span> : span ? <span className="text-ink-secondary"><b className="font-semibold text-ink">{span}</b> from start to handover · {plural(days, "working day")}</span> : null}</p>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div className={mark("weekdays")}>
                    <span id="weekdays-label" className={LABEL}>Working days</span>
                    <div role="group" aria-labelledby="weekdays-label" className="mt-2 flex gap-1.5">
                      {WEEKDAYS.map(([short, long], d) => {
                        const on = intake.weekdays.includes(d);
                        return (<button key={long} type="button" aria-pressed={on} aria-label={long} title={long} onClick={() => set("weekdays", on ? intake.weekdays.filter((x) => x !== d) : [...intake.weekdays, d].sort())} className={cn("press grid size-10 cursor-pointer place-items-center rounded-full border text-[13px] font-semibold transition-colors duration-200", on ? "border-copper bg-copper text-white" : "border-line-strong text-ink-tertiary hover:border-copper hover:text-brand", focusRing)}>{short}</button>);
                    })}
                    </div>
                  </div>
                  <div className={mark("offDates")}>
                    <span className={LABEL}>No work on</span>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {intake.offDates.map((d) => (<span key={d} className="inline-flex h-8 items-center gap-1 rounded-full bg-surface-sunken pr-1 pl-3 text-[12.5px] font-medium text-ink tabular">
                          {formatDate(d, { month: "short", day: "numeric" })}
                          <button type="button" onClick={() => set("offDates", intake.offDates.filter((x) => x !== d))} aria-label={`Remove ${day(d)}`} data-print-hide className={cn("press grid size-6 cursor-pointer place-items-center rounded-full hover:bg-line", focusRing)}><X className="size-3" aria-hidden/></button>
                        </span>))}
                      <span className="inline-flex items-center gap-1.5" data-print-hide>
                        <input type="date" aria-label="A date with no work" value={offDate} min={intake.startDate || undefined} max={intake.endDate || undefined} onChange={(e) => setOffDate(e.target.value)} className="h-8 rounded-full border border-line-strong bg-surface px-3 text-[12.5px] tabular outline-none focus:border-copper"/>
                        <button type="button" disabled={!offDate || intake.offDates.includes(offDate)} onClick={() => { set("offDates", [...intake.offDates, offDate].sort()); setOffDate(""); }} className={cn(softAction, "disabled:opacity-45")}><Plus aria-hidden/>Add</button>
                      </span>
                      {intake.offDates.length === 0 ? <span className="hidden text-[13px] text-ink-tertiary print:inline">&nbsp;</span> : null}
                    </div>
                  </div>
                </div>
              </Part>

              <Part id="report-team" title="Team" sub="Tap everyone working on this job. Each task goes to someone with the right role, and they see it as soon as you confirm.">
                <TeamCards crew={crew} value={intake.team} onChange={(ids) => set("team", ids)}/>
              </Part>

              <Part id="report-scope" title="Scope of work" sub="One entry per room or area. Tick the work it needs; notes are passed on to the plan.">
                <ScopeAreas value={intake.areas} onChange={(areas) => set("areas", areas)} highlighted={filled.has("areas")}/>
              </Part>

              <Part id="report-notes" title="Notes from the interview">
                <label className={cn("block", mark("notes"))}>
                  <span className="sr-only">Notes</span>
                  <textarea value={intake.notes} onChange={(e) => set("notes", e.target.value)} rows={3} maxLength={2000} placeholder="Site access, working hours, the client's preferences, anything the crew should know" className={cn(LINE, "field-sizing-content min-h-20 resize-none leading-relaxed")}/>
                </label>
              </Part>

              <footer className="mt-12 grid gap-8 text-[13px] sm:grid-cols-2">
                <div>
                  <p className="border-b border-ink pb-1 font-medium">{pmName}</p>
                  <p className="mt-1 text-ink-tertiary">Prepared by, project manager</p>
                </div>
                <div>
                  <p className="border-b border-ink pb-1">&nbsp;</p>
                  <p className="mt-1 text-ink-tertiary">Client&apos;s signature and date</p>
                </div>
              </footer>
            </article>

            {busy ? <BusyCard kind={busy} file={readFrom}/> : null}
            {dragging ? (<div aria-hidden data-print-hide className="pointer-events-none absolute inset-0 grid place-items-center rounded-[8px] border-2 border-dashed border-copper bg-brand-soft/85 backdrop-blur-[2px]">
                <span className="flex flex-col items-center gap-2 text-brand"><FileUp className="size-8" aria-hidden/><span className="text-base font-semibold">Drop to read it into the report</span></span>
              </div>) : null}
          </div>
        </div>

        <aside aria-label="Report progress" data-print-hide className="grid gap-4 max-lg:order-first lg:sticky lg:top-6">
          <section className="materialize material rounded-[20px] p-4" style={{ "--i": 2 } as React.CSSProperties}>
            <button type="button" onClick={pickFile} disabled={busy !== null} className={cn("group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-line-strong px-4 py-4 text-left transition-colors duration-200 hover:border-copper hover:bg-brand-soft/40 disabled:cursor-wait disabled:opacity-60", focusRing)}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-0.5 motion-reduce:transition-none">
                {busy === "read" ? <Loader2 className="size-5 animate-spin" aria-hidden/> : <FileUp className="size-5" aria-hidden/>}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">Start from a document</span>
                <span className="block text-[12.5px] leading-snug text-ink-tertiary">Your own report, a proposal or notes. PDF or photo, under 4 MB. Drop it anywhere here.</span>
              </span>
            </button>
          </section>

          <section className="materialize material hidden rounded-[20px] lg:block" style={{ "--i": 3 } as React.CSSProperties}>
            <ol className="px-2 pt-2">
              {steps.map((s) => (<li key={s.id}>
                  <button type="button" onClick={() => go(s.id)} className={cn("flex w-full cursor-pointer items-start gap-3 rounded-xl px-2.5 py-2.5 text-left hover:bg-surface-subtle", focusRing)}>
                    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-300", s.done ? "border-copper bg-copper text-white" : "border-line-strong")} aria-hidden>
                      {s.done ? <Check className="size-3" strokeWidth={3}/> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium text-ink">{s.label}<span className="sr-only">{s.done ? ", done" : ", to do"}</span></span>
                      <span className={cn("block truncate text-[12.5px]", s.done ? "text-ink-secondary" : "text-ink-tertiary")}>{s.value}</span>
                    </span>
                  </button>
                </li>))}
            </ol>
            <div className="border-t border-line px-4 pt-3.5 pb-4">
              {save}
              <p className="mt-2.5 text-center text-[12.5px] leading-snug text-ink-tertiary">{missing ?? "Nothing is created yet. You check the plan first."}</p>
              <button type="button" onClick={() => window.print()} className={cn("mx-auto mt-2 flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-[12.5px] font-medium text-ink-secondary hover:text-ink", focusRing)}><Printer className="size-3.5" aria-hidden/>Print a blank copy for interviews</button>
            </div>
          </section>
        </aside>
      </div>

      {/* Phones and tablets: the action rides at the bottom, clear of the chat button. */}
      <div data-print-hide className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-surface/95 py-3 pr-[4.75rem] pl-4 backdrop-blur-md sm:-mx-6 sm:pl-6 lg:hidden">
        {save}
        <p className="mt-1.5 truncate text-center text-xs text-ink-tertiary">{missing ?? "You check the plan before anything is created."}</p>
      </div>

      <SitePicker open={siteOpen} onOpenChange={setSiteOpen} initial={intake.site} onSave={async (pin) => { set("site", pin); return true; }}/>
    </div>);
}

type Step = { id: string; label: string; done: boolean; value: string };

function Part({ id, title, sub, children }: { id: string; title: string; sub?: string; children: React.ReactNode }) {
    return (<section id={id} aria-labelledby={`${id}-title`} className="mt-10 scroll-mt-6 break-inside-avoid-page">
      <h3 id={`${id}-title`} className="border-b border-line pb-2 text-[15px] font-semibold tracking-[0.04em] uppercase">{title}</h3>
      {sub ? <p className="mt-2 max-w-prose text-[13px] text-ink-tertiary" data-print-hide>{sub}</p> : null}
      <div className="mt-4">{children}</div>
    </section>);
}

/** What is happening while the AI works: the file being read, or the drafting steps advancing. */
function BusyCard({ kind, file }: { kind: "read" | "plan"; file: string | null }) {
    const [step, setStep] = React.useState(0);
    React.useEffect(() => {
        if (kind !== "plan")
            return;
        const t = setInterval(() => setStep((s) => Math.min(s + 1, DRAFT_STEPS.length - 1)), 2200);
        return () => clearInterval(t);
    }, [kind]);
    // Sticky inside a layer over the sheet, so it stays in view wherever the PM has scrolled.
    return (<div data-print-hide className="absolute inset-0 z-10">
      <div role="status" aria-live="polite" className="materialize sticky top-[28vh] mx-auto mt-24 w-[min(26rem,calc(100%-2rem))] rounded-[20px] bg-surface p-5 shadow-[0_2px_6px_rgb(0_0_0/0.06),0_24px_60px_-20px_rgb(60_40_20/0.45)] ring-1 ring-line">
      {kind === "read" ? (<div className="flex items-center gap-3">
          <Loader2 className="size-5 shrink-0 animate-spin text-copper" aria-hidden/>
          <p className="min-w-0 text-sm text-ink">Reading <b className="font-semibold break-all">{file ?? "your document"}</b><span className="block text-[12.5px] text-ink-tertiary">Dates, rooms, work and notes go into the report.</span></p>
        </div>) : (<>
          <p className="text-sm font-semibold text-ink">Drafting the plan</p>
          <ol className="mt-3 grid gap-2.5">
            {DRAFT_STEPS.map((s, i) => (<li key={s} className={cn("flex items-center gap-2.5 text-[13.5px] transition-colors duration-500", i < step ? "text-ink-secondary" : i === step ? "font-medium text-ink" : "text-ink-tertiary/70")}>
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", i < step ? "bg-copper text-white" : i === step ? "text-copper" : "border border-line-strong")} aria-hidden>
                  {i < step ? <Check className="size-3" strokeWidth={3}/> : i === step ? <Loader2 className="size-4 animate-spin"/> : null}
                </span>
                {s}
              </li>))}
          </ol>
          <p className="mt-3.5 text-xs text-ink-tertiary">Usually under half a minute. Nothing is created until you confirm.</p>
        </>)}
      </div>
    </div>);
}
