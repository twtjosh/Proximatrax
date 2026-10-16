import { HEALTH, logSentence, type StatusUpdate } from "@/lib/project-log";
import { daysBetween, formatDate, plural } from "@/lib/dashboard";
import type { TeamMember } from "@/lib/data/project-context";
import type { DashboardMilestone } from "@/lib/dashboard";
import type { PmTask } from "@/lib/pm-project";
import { forecastHandover } from "@/lib/project-insights";
import { peopleLoad } from "@/lib/people-load";
import { cn } from "@/lib/utils";
import { ROLE_TERMS } from "@/lib/vocabulary";
import type { ActivityWithActor } from "@/services/activity-service";

const d = (iso: string) => formatDate(iso.slice(0, 10), { month: "short", day: "numeric", year: "numeric" });
const RECENT_DAYS = 14;

/**
 * The project on one printable page, for the owner's meeting or the client's
 * folder: where it stands, milestones planned against delivered, what is
 * late, who carries what, what was accepted lately. Real data only.
 */
export function ProjectReport({ title, client, pm, start, end, status, milestones, tasks, team, update, activity, photos, today }: {
    title: string;
    client: string;
    pm: string;
    start: string;
    end: string;
    status: string;
    milestones: DashboardMilestone[];
    tasks: PmTask[];
    team: TeamMember[];
    update: StatusUpdate | null;
    activity: ActivityWithActor[];
    /** Photos of recently accepted work, by task. */
    photos: Record<string, string[]>;
    today: string;
}) {
    const accepted = tasks.filter((t) => t.stage === "done");
    const late = tasks.filter((t) => t.stage !== "done" && t.due_date && t.due_date < today).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
    const forecast = forecastHandover(start, end, tasks, today);
    const recent = accepted.filter((t) => daysBetween((t.client_visible_at ?? t.updated_at).slice(0, 10), today) <= RECENT_DAYS)
        .sort((a, b) => (b.client_visible_at ?? b.updated_at).localeCompare(a.client_visible_at ?? a.updated_at));
    const crew = peopleLoad(team, tasks, today).filter((p) => p.role === ROLE_TERMS.middleman);
    const name = (id: string | null) => team.find((m) => m.id === id)?.name ?? "No one";
    const share = tasks.length ? Math.round((accepted.length / tasks.length) * 100) : 0;

    return (<article className="print-record mx-auto w-full max-w-[52rem] rounded-[20px] bg-surface p-8 text-ink shadow-card ring-1 ring-line sm:p-12 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0">
        <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.08em] text-ink-tertiary uppercase">Project report</p>
            <h1 className="mt-1 text-[1.9rem] leading-tight font-semibold tracking-[-0.03em]">{title}</h1>
            <p className="mt-1 text-sm text-ink-secondary">For {client} · Project manager {pm}</p>
          </div>
          <div className="text-right text-xs text-ink-secondary">
            <p className="font-semibold text-ink">ProximaTrax</p>
            <p>AEG Home Fashion</p>
            <p className="mt-2">As of {d(today)}</p>
          </div>
        </header>

        <section className="grid grid-cols-4 gap-4 border-b border-line py-5">
          <Fact label="Schedule" value={`${d(start)} – ${d(end)}`}/>
          <Fact label="Status" value={status}/>
          <Fact label="Progress" value={`${share}% · ${accepted.length} of ${plural(tasks.length, "task")}`}/>
          <Fact label="Handover forecast" value={forecast ? `${d(forecast.date)}${forecast.slip > 0 ? ` (${forecast.slip}d late)` : " (on time)"}` : "Not enough data yet"}/>
        </section>

        {update ? (<section className="border-b border-line py-5">
            <H>Status: {HEALTH[update.health].label} <span className="font-normal text-ink-tertiary">· {d(update.at)}</span></H>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{update.note}</p>
          </section>) : null}

        <section className="border-b border-line py-5">
          <H>Milestones</H>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-ink-tertiary"><th className="py-1.5 font-medium">Milestone</th><th className="py-1.5 font-medium">Due</th><th className="py-1.5 font-medium">Tasks accepted</th><th className="py-1.5 text-right font-medium">State</th></tr></thead>
            <tbody>
              {[...milestones].sort((a, b) => a.due_date.localeCompare(b.due_date)).map((m) => {
            const linked = tasks.filter((t) => t.milestone_id === m.id);
            const state = m.completed ? "Delivered" : m.due_date < today ? `Late ${daysBetween(m.due_date, today)}d` : "Open";
            return (<tr key={m.id} className="border-b border-line/60 last:border-0">
                    <td className="py-2 font-medium">{m.title}</td>
                    <td className="py-2 tabular">{d(m.due_date)}</td>
                    <td className="py-2 tabular">{linked.filter((t) => t.stage === "done").length} of {linked.length}</td>
                    <td className={cn("py-2 text-right font-medium", m.completed ? "text-success" : m.due_date < today ? "text-danger" : "text-ink-secondary")}>{state}</td>
                  </tr>);
        })}
            </tbody>
          </table>
          {milestones.length === 0 ? <p className="text-sm text-ink-tertiary">No milestones set.</p> : null}
        </section>

        <section className="grid gap-8 border-b border-line py-5 sm:grid-cols-2 print:grid-cols-2">
          <div>
            <H>Late work <span className="font-normal text-ink-tertiary">{late.length}</span></H>
            {late.length ? (<ul className="grid gap-1.5 text-sm">
                {late.slice(0, 8).map((t) => <li key={t.id} className="flex justify-between gap-3"><span className="truncate">{t.title} <span className="text-ink-tertiary">· {name(t.assigned_to)}</span></span><span className="shrink-0 font-medium text-danger tabular">{daysBetween(t.due_date!, today)}d</span></li>)}
                {late.length > 8 ? <li className="text-xs text-ink-tertiary">and {late.length - 8} more</li> : null}
              </ul>) : <p className="text-sm text-ink-tertiary">Nothing is late.</p>}
          </div>
          <div>
            <H>Crew</H>
            {crew.length ? (<table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-ink-tertiary"><th className="pb-1 font-medium">Person</th><th className="pb-1 text-right font-medium">Open</th><th className="pb-1 text-right font-medium">Late</th><th className="pb-1 text-right font-medium">Accepted</th></tr></thead>
                <tbody>{crew.map((p) => <tr key={p.id}><td className="py-1">{p.name}</td><td className="py-1 text-right tabular">{p.open}</td><td className={cn("py-1 text-right tabular", p.late && "font-medium text-danger")}>{p.late}</td><td className="py-1 text-right tabular">{tasks.filter((t) => t.assigned_to === p.id && t.stage === "done").length}</td></tr>)}</tbody>
              </table>) : <p className="text-sm text-ink-tertiary">No crew on the project.</p>}
          </div>
        </section>

        <section className="border-b border-line py-5">
          <H>Accepted in the last {RECENT_DAYS} days <span className="font-normal text-ink-tertiary">{recent.length}</span></H>
          {recent.length ? (<ul className="grid gap-3">
              {recent.slice(0, 8).map((t) => (<li key={t.id} className="flex items-center gap-3 text-sm">
                  <span className="flex shrink-0 gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- report photo */}
                    {(photos[t.id] ?? []).slice(0, 2).map((url) => <img key={url} src={url} alt="" className="size-12 rounded-md object-cover"/>)}
                  </span>
                  <span className="min-w-0 flex-1"><span className="font-medium">{t.title}</span><span className="block text-xs text-ink-tertiary">{name(t.assigned_to)} · accepted {d(t.client_visible_at ?? t.updated_at)}</span></span>
                </li>))}
            </ul>) : <p className="text-sm text-ink-tertiary">Nothing accepted in this period.</p>}
        </section>

        <section className="py-5">
          <H>Latest activity</H>
          <ul className="grid gap-1 text-[13px]">
            {activity.slice(0, 10).map((r) => <li key={r.id} className="flex gap-3"><span className="w-24 shrink-0 text-ink-tertiary tabular">{d(r.created_at)}</span><span><b className="font-medium">{r.actor?.full_name ?? "Someone"}</b> {logSentence(r)}</span></li>)}
          </ul>
        </section>

        <footer className="border-t border-line pt-4 text-[11px] text-ink-tertiary">Generated by ProximaTrax on {d(today)}. Figures reflect accepted work only; work in review is not counted as done.</footer>
      </article>);
}

function Fact({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div>
      <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-tertiary uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>);
}

function H({ children }: {
    children: React.ReactNode;
}) {
    return <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">{children}</h2>;
}
