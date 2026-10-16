"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, ChevronLeft, Loader2, Send } from "lucide-react";
import { Face, focusRing, primaryAction } from "@/components/dashboard/overview-kit";
import { PersonPicker, type PersonOption } from "@/components/projects/new/person-picker";
import { Switch } from "@/components/ui/switch";
import { projectPath, ROUTES } from "@/lib/constants";
import { formatDate } from "@/lib/dashboard";
import { DEFAULT_LIFECYCLE_TEMPLATE, templateMilestones } from "@/lib/milestone-template";
import { addWeeks, endDateError, missingPhrase, spanPhrase } from "@/lib/new-project";
import { cn, getErrorMessage } from "@/lib/utils";
import { PROJECT_STATUS_TERMS } from "@/lib/vocabulary";

const FIELD = "w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-tertiary hover:border-ink-tertiary/50 focus:border-copper focus:ring-4 focus:ring-copper/15 aria-invalid:border-danger aria-invalid:ring-4 aria-invalid:ring-danger/10";
const QUICK_WEEKS = [4, 8, 12];

/**
 * The PM opens a project: what it is, who is invited, when it runs and the
 * plan it starts with. The panel beside the form says what creating it will
 * do, and holds the one action.
 */
export function NewProjectForm({ today, clients, middlemen }: {
    /** ISO date (Manila); the start date begins here. */
    today: string;
    clients: PersonOption[];
    middlemen: PersonOption[];
}) {
    const router = useRouter();
    const [title, setTitle] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [clientId, setClientId] = React.useState("");
    const [middlemanId, setMiddlemanId] = React.useState("");
    const [startDate, setStartDate] = React.useState(today);
    const [endDate, setEndDate] = React.useState("");
    const [useTemplate, setUseTemplate] = React.useState(true);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const day = (iso: string) => formatDate(iso, { month: "short", day: "numeric", ...(iso.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }) });
    const client = clients.find((p) => p.id === clientId) ?? null;
    const middleman = middlemen.find((p) => p.id === middlemanId) ?? null;
    const span = spanPhrase(startDate, endDate);
    const dateError = endDateError(startDate, endDate);
    const missing = missingPhrase({ title, clientId, middlemanId, startDate, endDate });
    const blocker = dateError ? "Fix the end date first" : missing;
    const milestones = templateMilestones(startDate, endDate);

    async function create() {
        if (blocker || busy)
            return;
        setBusy(true);
        setError(null);
        try {
            const res = await fetch("/api/projects/with-invitations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, description: description || null, clientId, middlemanId, startDate, endDate, useTemplate }),
            });
            const payload = (await res.json()) as { error?: string; projectId?: string };
            if (!res.ok || !payload.projectId)
                throw new Error(payload.error ?? "The project was not created.");
            router.push(projectPath(payload.projectId));
            router.refresh();
        }
        catch (err) {
            setError(getErrorMessage(err));
            setBusy(false);
        }
    }

    const action = (<button type="submit" form="new-project" disabled={Boolean(blocker) || busy} className={cn(primaryAction, "h-11 w-full justify-center disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none")}>
        {busy ? <Loader2 className="animate-spin" aria-hidden/> : <Send aria-hidden/>}
        {busy ? "Creating the project…" : "Create project & send invites"}
      </button>);

    return (<div className="mx-auto w-full max-w-6xl pb-10">
      <Link href={ROUTES.PROJECTS} className={cn("inline-flex items-center gap-1 text-[13px] font-medium text-ink-tertiary hover:text-ink", focusRing)}>
        <ChevronLeft className="size-4" aria-hidden/>Projects
      </Link>
      <header className="materialize mt-2.5">
        <h1 className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-ink sm:text-[2.5rem]">New project</h1>
        <p className="mt-2 text-[15px] text-ink-tertiary">You’ll be its project manager. The client and middleman join once they accept their invitations.</p>
      </header>

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <form id="new-project" noValidate onSubmit={(e) => { e.preventDefault(); void create(); }} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void create(); } }} className="materialize material rounded-[20px]" style={{ "--i": 1 } as React.CSSProperties}>
          <Section title="Project" sub="What the client sees at the top of every page.">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="title" className="text-[13px] font-medium text-ink">Title</label>
              <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Salcedo Residence" autoComplete="off" autoFocus maxLength={120} className={cn(FIELD, "h-13 text-lg font-medium tracking-[-0.01em]")}/>
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="description" className="flex justify-between text-[13px] font-medium text-ink">Scope notes<span className="font-normal text-ink-tertiary">Optional</span></label>
              <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What’s included, constraints, what handover looks like" className={cn(FIELD, "min-h-24 resize-y py-3 leading-relaxed")}/>
            </div>
          </Section>

          <Section title="People" sub="Both get an invitation as soon as you create the project.">
            <div className="grid gap-4 sm:grid-cols-2">
              <PersonPicker id="client" label="Client" noun="client" people={clients} value={clientId} onChange={setClientId} help="Sees the milestones and photos you approve."/>
              <PersonPicker id="middleman" label="Middleman" noun="middleman" people={middlemen} value={middlemanId} onChange={setMiddlemanId} help="Runs the work on site and submits it for your review."/>
            </div>
          </Section>

          <Section title="Schedule" sub="The planned start and handover. Milestones are placed inside it.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="start-date" className="text-[13px] font-medium text-ink">Start date</label>
                <input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={cn(FIELD, "h-11 tabular")}/>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="end-date" className="text-[13px] font-medium text-ink">End date</label>
                <input id="end-date" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} required aria-invalid={Boolean(dateError)} aria-describedby="end-date-note" className={cn(FIELD, "h-11 tabular")}/>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Set the end date from the start date">
              {QUICK_WEEKS.map((w) => {
                  const end = startDate ? addWeeks(startDate, w) : "";
                  return (<button key={w} type="button" disabled={!startDate} aria-pressed={endDate === end} onClick={() => setEndDate(end)} className={cn("press h-8 rounded-full border border-line-strong bg-surface px-3 text-[12.5px] font-medium text-ink-secondary hover:border-copper hover:text-brand disabled:opacity-45 aria-pressed:border-copper/45 aria-pressed:bg-brand-soft aria-pressed:text-brand", focusRing)}>+{w} weeks</button>);
              })}
            </div>
            <p id="end-date-note" aria-live="polite" className="mt-3 text-[13px]">
              {dateError
                ? <span className="inline-flex items-center gap-1.5 text-danger"><AlertCircle className="size-3.5" aria-hidden/>{dateError}</span>
                : span
                    ? <span className="text-ink-secondary"><b className="font-semibold text-ink">{span}</b> · {day(startDate)} to {day(endDate)}</span>
                    : <span className="text-ink-tertiary">Pick an end date, or add weeks to the start.</span>}
            </p>
          </Section>

          <Section title="Milestones" sub="A starting plan you can change on the Timeline.">
            <label className="flex cursor-pointer items-start gap-3">
              <Switch checked={useTemplate} onCheckedChange={setUseTemplate} className="mt-0.5 data-checked:bg-copper"/>
              <span>
                <span className="block text-sm font-medium text-ink">Start with the standard five milestones</span>
                <span className="block text-[12.5px] text-ink-tertiary">Spread evenly across the schedule. You can rename, move or delete them later.</span>
              </span>
            </label>
            {useTemplate ? (<ol className={cn("mt-4", !milestones && "opacity-45")} aria-label="Milestones it starts with">
                {(milestones ?? DEFAULT_LIFECYCLE_TEMPLATE.map((t) => ({ title: t, due_date: "" }))).map((m, i, all) => (<li key={m.title} className="relative grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-3 py-2">
                    <span className={cn("absolute left-2 w-0.5 bg-line", i === 0 ? "top-1/2 bottom-0" : i === all.length - 1 ? "top-0 bottom-1/2" : "inset-y-0")} aria-hidden/>
                    <span className="relative ml-[3px] size-3 rounded-full border-2 border-copper bg-surface" aria-hidden/>
                    <span className="text-[13.5px] text-ink">{m.title}</span>
                    <span className="text-[12.5px] text-ink-tertiary tabular">{m.due_date ? day(m.due_date) : "needs dates"}</span>
                  </li>))}
              </ol>) : <p className="mt-3 text-[12.5px] text-ink-tertiary">You’ll add milestones yourself on the Timeline.</p>}
          </Section>
        </form>

        <aside aria-label="What happens when you create it" className="materialize material rounded-[20px] lg:sticky lg:top-6" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="border-b border-line px-5 pt-5 pb-4">
            <p className="text-[12.5px] text-ink-tertiary">When you create it</p>
            <p className={cn("mt-1 text-xl font-semibold tracking-[-0.022em] break-words", title.trim() ? "text-ink" : "text-ink-tertiary")}>{title.trim() || "Untitled project"}</p>
            <p className="mt-0.5 text-[13px] text-ink-secondary">{span && !dateError ? `${day(startDate)} to ${day(endDate)} · ${span}` : "Dates not set"}</p>
          </div>
          <div className="border-b border-line px-5 py-4">
            <p className="mb-1.5 text-[12.5px] font-medium text-ink-tertiary">Invitations</p>
            <Invitee person={client} role="Client"/>
            <Invitee person={middleman} role="Middleman"/>
          </div>
          <div className="px-5 py-4">
            <p className="mb-2 text-[12.5px] font-medium text-ink-tertiary">Then</p>
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-warning-soft px-2.5 py-1 font-medium text-warning">{PROJECT_STATUS_TERMS.pending_invites.label}</span>
              <ArrowRight className="size-3.5 text-ink-tertiary" aria-hidden/>
              <span className="rounded-full bg-surface-sunken px-2.5 py-1 font-medium text-ink-secondary">{PROJECT_STATUS_TERMS.planning.label}</span>
            </p>
            <p className="mt-2 text-[12.5px] text-ink-tertiary">The project waits until both accept, then opens for planning.</p>
          </div>
          {error ? (<p role="alert" className="mx-5 mb-1 flex gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden/>
              <span>{error} Your entries are kept; try again.</span>
            </p>) : null}
          <div className="hidden border-t border-line px-5 pt-4 pb-5 lg:block">
            {action}
            <p className="mt-2.5 text-center text-[12.5px] text-ink-tertiary">{blocker ?? <>Press <kbd className="rounded border border-line-strong px-1 shadow-[inset_0_-1px_0_var(--color-line-strong)] font-sans text-[11px]">Ctrl</kbd> <kbd className="rounded border border-line-strong px-1 shadow-[inset_0_-1px_0_var(--color-line-strong)] font-sans text-[11px]">Enter</kbd> to create</>}</p>
          </div>
        </aside>
      </div>

      {/* On phones and tablets the action rides at the bottom of the screen. */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-5 border-t border-line bg-surface/95 px-4 pt-3 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
        {action}
        {blocker ? <p className="mt-1.5 text-center text-xs text-ink-tertiary">{blocker}</p> : null}
      </div>
    </div>);
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
    return (<fieldset className="min-w-0 border-t border-line px-5 py-6 first:border-t-0 sm:px-7">
      <legend className="float-left w-full">
        <span className="block text-base font-semibold tracking-[-0.014em] text-ink">{title}</span>
        <span className="mt-0.5 mb-4 block text-[13px] text-ink-tertiary">{sub}</span>
      </legend>
      <div className="clear-left">{children}</div>
    </fieldset>);
}

function Invitee({ person, role }: { person: PersonOption | null; role: string }) {
    return (<div className="flex items-center gap-2.5 py-1.5">
      {person ? <Face person={{ id: person.id, name: person.name, avatarUrl: person.avatarUrl, role: "" }} size={32}/> : <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs text-ink-tertiary" aria-hidden>?</span>}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[13.5px] font-medium", person ? "text-ink" : "text-ink-tertiary")}>{person?.name ?? `No ${role.toLowerCase()} yet`}</span>
        <span className="block text-xs text-ink-tertiary">{role}</span>
      </span>
      {person ? <span className="shrink-0 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">Gets an invite</span> : null}
    </div>);
}
