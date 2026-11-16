"use client";
import * as React from "react";
import Link from "next/link";
import { AlertCircle, ChevronLeft, FileUp, Loader2, MapPin, Plus, Printer, Sparkles, X } from "lucide-react";
import { focusRing, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { PersonPicker, type PersonOption } from "@/components/projects/new/person-picker";
import { PlanReview } from "@/components/projects/new/plan-review";
import { LINE, ScopeAreas } from "@/components/projects/new/scope-areas";
import { TeamCards, type CrewOption } from "@/components/projects/new/team-cards";
import { SitePicker } from "@/components/projects/pm/site-picker";
import type { PlannedMilestone } from "@/lib/auto-plan";
import { ROUTES } from "@/lib/constants";
import { formatDate } from "@/lib/dashboard";
import { endDateError, spanPhrase } from "@/lib/new-project";
import { BUSY_MESSAGE } from "@/lib/gemini";
import { asIntake, emptyIntake, intakeMissing, MAX_REPORT_UPLOAD_BYTES, REPORT_UPLOAD_TYPES, type Intake } from "@/lib/project-intake";
import { cn, getErrorMessage } from "@/lib/utils";

const DRAFT_KEY = "intake-draft";
const WEEKDAYS = [["S", "Sunday"], ["M", "Monday"], ["T", "Tuesday"], ["W", "Wednesday"], ["T", "Thursday"], ["F", "Friday"], ["S", "Saturday"]] as const;
const READ_MARK = "rounded-lg bg-brand-soft/60 ring-4 ring-brand-soft/60 print:bg-transparent print:ring-0";

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
 * client interview. It prints blank for interviews on paper, reads a filled
 * copy back in, and on Save asks Gemini to draft the plan.
 */
export function ReportForm({ today, pmName, clients, crew }: {
    today: string;
    pmName: string;
    clients: PersonOption[];
    crew: CrewOption[];
}) {
    const [intake, setIntake] = React.useState<Intake>(() => emptyIntake(today));
    const [filled, setFilled] = React.useState<Set<string>>(new Set());
    const [busy, setBusy] = React.useState<"read" | "plan" | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [plan, setPlan] = React.useState<PlannedMilestone[] | null>(null);
    const [siteOpen, setSiteOpen] = React.useState(false);
    const [offDate, setOffDate] = React.useState("");
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
    const day = (iso: string) => formatDate(iso, { month: "short", day: "numeric", year: "numeric" });

    async function upload(file: File) {
        setError(null);
        if (!REPORT_UPLOAD_TYPES.includes(file.type))
            return setError("Upload the report as a PDF, JPG or PNG.");
        if (file.size > MAX_REPORT_UPLOAD_BYTES)
            return setError("That file is too large. Use one under 4 MB, or take the photo again at a lower size.");
        setBusy("read");
        try {
            const body = new FormData();
            body.append("file", file);
            const res = await fetch("/api/project-report/read", { method: "POST", body });
            // A timed-out function answers with an HTML page, not JSON.
            const data = (await res.json().catch(() => ({ error: BUSY_MESSAGE }))) as { error?: string; intake?: Intake; filled?: (keyof Intake)[] };
            if (!res.ok || !data.intake)
                throw new Error(data.error ?? "The report could not be read.");
            const read = data.intake, keys = data.filled ?? [];
            setIntake((i) => ({ ...i, ...Object.fromEntries(keys.map((k) => [k, read[k]])) }));
            setFilled(new Set(keys));
            if (keys.length === 0)
                setError("Nothing could be read from that file. Check it is this report form, clearly photographed.");
        }
        catch (e) {
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
            window.scrollTo({ top: 0 });
        }
        catch (e) {
            setError(getErrorMessage(e));
        }
        finally {
            setBusy(null);
        }
    }

    if (plan)
        return <PlanReview intake={intake} plan={plan} crew={crew} clientName={clients.find((c) => c.id === intake.clientId)?.name ?? ""} onBack={() => setPlan(null)} onRegenerate={draftPlan} regenerating={busy === "plan"} regenerateError={error} onConfirmed={clearDraft}/>;

    const save = (<button type="button" onClick={() => void draftPlan()} disabled={Boolean(missing) || busy !== null} className={cn(primaryAction, "h-11 justify-center disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none")}>
        {busy === "plan" ? <Loader2 className="animate-spin" aria-hidden/> : <Sparkles aria-hidden/>}
        {busy === "plan" ? "Drafting the plan…" : "Save & draft the plan"}
      </button>);

    return (<div className="mx-auto w-full max-w-[56rem] pb-10">
      <div data-print-hide>
        <Link href={ROUTES.PROJECTS} className={cn("inline-flex items-center gap-1 text-[13px] font-medium text-ink-tertiary hover:text-ink", focusRing)}>
          <ChevronLeft className="size-4" aria-hidden/>Projects
        </Link>
        <header className="materialize mt-2.5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-ink sm:text-[2.5rem]">New project</h1>
            <p className="mt-2 max-w-xl text-[15px] text-ink-tertiary">Fill in the project report from the client interview. On save, the milestones, tasks, deadlines and who does what are drafted for you to check.</p>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept={REPORT_UPLOAD_TYPES.join(",")} className="sr-only" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }}/>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null} className={cn(softAction, "h-10 px-4 disabled:opacity-45")}>
              {busy === "read" ? <Loader2 className="animate-spin" aria-hidden/> : <FileUp aria-hidden/>}{busy === "read" ? "Reading…" : "Upload filled report"}
            </button>
            <button type="button" onClick={() => window.print()} className={cn(softAction, "h-10 px-4")}><Printer aria-hidden/>Print</button>
          </div>
        </header>
        {filled.size > 0 ? (<p role="status" className="mt-5 flex items-start gap-2 rounded-xl bg-brand-soft px-4 py-3 text-[13.5px] text-brand">
            <FileUp className="mt-0.5 size-4 shrink-0" aria-hidden/>
            <span className="flex-1">Read from your file. Check the highlighted fields before saving.</span>
            <button type="button" onClick={() => setFilled(new Set())} aria-label="Hide highlights" className={cn("press -m-1 grid size-6 cursor-pointer place-items-center rounded-full hover:bg-white/50", focusRing)}><X className="size-3.5" aria-hidden/></button>
          </p>) : null}
        {error ? (<p role="alert" className="mt-5 flex gap-2 rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden/><span>{error}</span>
          </p>) : null}
      </div>

      <article className="print-record materialize mt-6 rounded-[6px] [print-color-adjust:exact] bg-surface px-6 py-8 text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06),0_18px_40px_-18px_rgb(60_40_20/0.35)] ring-1 ring-line sm:px-12 sm:py-12 print:mt-0 print:rounded-none print:p-0 print:shadow-none print:ring-0" style={{ "--i": 1 } as React.CSSProperties}>
        <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-tertiary uppercase">AEG Home Fashion · ProximaTrax</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[0.06em] uppercase sm:text-[1.7rem]">Project report</h2>
          </div>
          <p className="text-right text-[12.5px] text-ink-secondary">Prepared<br/><span className="tabular">{day(today)}</span></p>
        </header>

        <Part n={1} title="Project">
          <label className={cn("block", mark("title"))}>
            <span className="text-[11px] font-semibold tracking-[0.08em] text-ink-tertiary uppercase">Project title</span>
            <input value={intake.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Salcedo Residence kitchen and living room" maxLength={160} className={cn(LINE, "mt-1 text-lg font-medium")}/>
          </label>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className={mark("clientId")}>
              <PersonPicker id="client" label="Client" noun="client" people={clients} value={intake.clientId} onChange={(id) => set("clientId", id)} help="Gets an invitation and sees the milestones and photos you approve."/>
            </div>
            <div>
              <span className="text-[13px] font-medium text-ink">Site</span>
              <button type="button" onClick={() => setSiteOpen(true)} className={cn("mt-1.5 flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-left hover:border-ink-tertiary/50 print:border-0 print:border-b print:border-dashed print:px-0", focusRing)}>
                <MapPin className="size-4 shrink-0 text-copper" aria-hidden/>
                <span className={cn("text-[14px]", intake.site ? "text-ink tabular" : "text-ink-tertiary")}>{intake.site ? `${intake.site.lat.toFixed(5)}, ${intake.site.lng.toFixed(5)}` : "Pick the site on the map (optional)"}</span>
              </button>
              <p className="mt-1.5 text-xs text-ink-tertiary" data-print-hide>Site photos are checked against this pin.</p>
            </div>
          </div>
        </Part>

        <Part n={2} title="Schedule">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={cn("block", mark("startDate"))}>
              <span className="text-[11px] font-semibold tracking-[0.08em] text-ink-tertiary uppercase">Start date</span>
              <input type="date" value={intake.startDate} onChange={(e) => set("startDate", e.target.value)} className={cn(LINE, "mt-1 tabular")}/>
            </label>
            <label className={cn("block", mark("endDate"))}>
              <span className="text-[11px] font-semibold tracking-[0.08em] text-ink-tertiary uppercase">Handover (end date)</span>
              <input type="date" value={intake.endDate} min={intake.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} aria-invalid={Boolean(dateError)} className={cn(LINE, "mt-1 tabular aria-invalid:border-danger")}/>
            </label>
          </div>
          <p className="mt-2 text-[13px]" aria-live="polite">{dateError ? <span className="text-danger">{dateError}</span> : span ? <span className="text-ink-secondary"><b className="font-semibold text-ink">{span}</b> from start to handover</span> : null}</p>
          <div className={cn("mt-5", mark("weekdays"))}>
            <span id="weekdays-label" className="text-[11px] font-semibold tracking-[0.08em] text-ink-tertiary uppercase">Working days</span>
            <div role="group" aria-labelledby="weekdays-label" className="mt-2 flex gap-1.5">
              {WEEKDAYS.map(([short, long], d) => {
                    const on = intake.weekdays.includes(d);
                    return (<button key={long} type="button" aria-pressed={on} aria-label={long} onClick={() => set("weekdays", on ? intake.weekdays.filter((x) => x !== d) : [...intake.weekdays, d].sort())} className={cn("press grid size-10 cursor-pointer place-items-center rounded-full border text-[13px] font-semibold transition-colors duration-200", on ? "border-copper bg-copper text-white" : "border-line-strong text-ink-tertiary hover:border-copper", focusRing)}>{short}</button>);
                })}
            </div>
          </div>
          <div className={cn("mt-5", mark("offDates"))}>
            <span className="text-[11px] font-semibold tracking-[0.08em] text-ink-tertiary uppercase">No work on</span>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {intake.offDates.map((d) => (<span key={d} className="inline-flex h-8 items-center gap-1 rounded-full bg-surface-sunken pr-1 pl-3 text-[12.5px] font-medium text-ink tabular">
                  {day(d)}
                  <button type="button" onClick={() => set("offDates", intake.offDates.filter((x) => x !== d))} aria-label={`Remove ${day(d)}`} data-print-hide className={cn("press grid size-6 cursor-pointer place-items-center rounded-full hover:bg-line", focusRing)}><X className="size-3" aria-hidden/></button>
                </span>))}
              <span className="inline-flex items-center gap-1.5" data-print-hide>
                <input type="date" aria-label="A date with no work" value={offDate} min={intake.startDate || undefined} max={intake.endDate || undefined} onChange={(e) => setOffDate(e.target.value)} className="h-8 rounded-full border border-line-strong bg-surface px-3 text-[12.5px] tabular outline-none focus:border-copper"/>
                <button type="button" disabled={!offDate || intake.offDates.includes(offDate)} onClick={() => { set("offDates", [...intake.offDates, offDate].sort()); setOffDate(""); }} className={cn(softAction, "disabled:opacity-45")}><Plus aria-hidden/>Add</button>
              </span>
            </div>
          </div>
        </Part>

        <Part n={3} title="Team" sub="Tap everyone working on this job. Tasks go to people with the right role.">
          <TeamCards crew={crew} value={intake.team} onChange={(ids) => set("team", ids)} highlighted={filled.has("team")}/>
        </Part>

        <Part n={4} title="Scope of work" sub="One entry per area. Tick the work it needs.">
          <ScopeAreas value={intake.areas} onChange={(areas) => set("areas", areas)} highlighted={filled.has("areas")}/>
        </Part>

        <Part n={5} title="Notes from the interview">
          <label className={cn("block", mark("notes"))}>
            <span className="sr-only">Notes</span>
            <textarea value={intake.notes} onChange={(e) => set("notes", e.target.value)} rows={3} maxLength={2000} placeholder="Access to the site, the client's preferences, anything the crew should know" className={cn(LINE, "resize-y leading-relaxed")}/>
          </label>
        </Part>

        <footer className="mt-10 grid gap-8 text-[13px] sm:grid-cols-2">
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

      <div data-print-hide className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-surface/95 px-4 pt-3 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:flex lg:items-center lg:justify-end lg:gap-4 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <p className="mb-2 text-center text-xs text-ink-tertiary lg:mb-0 lg:text-right lg:text-[13px]">{missing ?? "Ready. The plan is drafted for you to check before anything is created."}</p>
        <div className="grid lg:block">{save}</div>
      </div>

      <SitePicker open={siteOpen} onOpenChange={setSiteOpen} initial={intake.site} onSave={async (pin) => { set("site", pin); return true; }}/>
    </div>);
}

function Part({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
    return (<section className="mt-9 break-inside-avoid-page">
      <h3 className="flex items-baseline gap-3 border-b border-line pb-2">
        <span className="text-[13px] font-semibold text-copper tabular">{String(n).padStart(2, "0")}</span>
        <span className="text-[15px] font-semibold tracking-[0.04em] uppercase">{title}</span>
      </h3>
      {sub ? <p className="mt-2 text-[13px] text-ink-tertiary" data-print-hide>{sub}</p> : null}
      <div className="mt-4">{children}</div>
    </section>);
}
