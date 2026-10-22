"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarRange, ChevronRight, MessageSquare } from "lucide-react";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { DayHeader, Face, focusRing, ProgressRing, softAction, stagger, trackSpotlight } from "@/components/dashboard/overview-kit";
import { useLiveUnread } from "@/components/messenger/messenger-store";
import { OpenChatButton } from "@/components/messenger/open-chat-button";
import { RecentUpdates } from "@/components/projects/client/recent-updates";
import { useVisitBaseline } from "@/components/projects/client/visit-baseline";
import { clientHealth, newSince, type ClientPhoto } from "@/lib/client-project";
import { projectPath, projectTimelinePath, ROUTES } from "@/lib/constants";
import type { ClientProjectData } from "@/lib/data/client-project";
import { agoPhrase, daysBetween, formatDate, isoDateIn, plural, type DashboardMilestone } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { ROLE_TERMS } from "@/lib/vocabulary";
import type { ProjectWithRelations } from "@/services/project-service";

type ClientPortalHomeProps = {
    firstName: string;
    /** "Good morning" and so on, worked out in Manila on the server. */
    greeting: string;
    /** ISO date (Manila). */
    today: string;
    /** Active projects the client belongs to; the first leads the page. */
    projects: ProjectWithRelations[];
    milestones: DashboardMilestone[];
    /** The lead project as its own pages read it; null when there is none or it couldn't be read. */
    lead: ClientProjectData | null;
    /** Pending project invitations, shown under the greeting. */
    notice?: React.ReactNode;
};

const byDue = (a: DashboardMilestone, b: DashboardMilestone) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

/**
 * The client's home: their space taking shape. The newest approved photo
 * leads; progress is told in milestones (the phases a client recognises,
 * never internal tasks) as one compact card; their project manager's latest
 * word sits with a way to answer it; then the newest accepted work. Built to
 * read on one phone screen before anything needs a scroll.
 */
export function ClientPortalHome({ firstName, greeting, today, projects, milestones, lead, notice }: ClientPortalHomeProps) {
    const featured = projects[0];
    const others = projects.slice(1);
    const own = featured ? milestones.filter((m) => m.project_id === featured.id).sort(byDue) : [];
    const photo = lead?.photos[0];

    return (<div className="mx-auto w-full max-w-6xl pb-8">
      <LiveRefresh channel="client-overview"/>
      <DayHeader today={today} title={`${greeting}, ${firstName}`}/>

      {notice ? <div className="materialize mt-5" style={stagger(1)}>{notice}</div> : null}

      {!featured ? (<div className="materialize mt-5 max-w-xl rounded-[20px] material px-7 py-8" style={stagger(1)}>
          <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-ink">Your project will appear here</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">Once your project manager adds you to a project, you&apos;ll see its progress, photos from the site and a direct line to your project manager.</p>
          <Link href={ROUTES.PROJECTS} className={cn(softAction, "mt-5")}>See past projects</Link>
        </div>) : (<>
          {photo ? <PhotoHero project={featured} photo={photo} today={today}/> : <TitleBand project={featured} today={today}/>}

          {/* Phone: progress, then the PM, then updates. Desk: the PM holds the right column beside the other two. */}
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Progress project={featured} milestones={own} today={today} className="lg:col-start-1"/>
            <ManagerCard project={featured} lead={lead} today={today} className="lg:col-start-2 lg:row-span-2 lg:row-start-1"/>
            {lead ? <LeadUpdates data={lead} className="lg:col-start-1"/> : null}
          </div>

          {others.length > 0 ? (<section aria-labelledby="other-projects-heading" className="mt-10">
              <h2 id="other-projects-heading" className="materialize text-[17px] font-semibold tracking-[-0.016em] text-ink" style={stagger(6)}>Your other projects</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((p, i) => {
                    const ms = milestones.filter((m) => m.project_id === p.id);
                    const done = ms.filter((m) => m.completed).length;
                    return (<li key={p.id} className="materialize flex" style={stagger(i + 7)}>
                      <Link href={projectPath(p.id)} onPointerMove={trackSpotlight} className={cn("spotlight material-interactive press press-soft flex w-full items-center gap-4 rounded-[20px] material p-5", focusRing)}>
                        <ProgressRing value={ms.length ? done / ms.length : 0} size={48} stroke={5}/>
                        <span className="min-w-0">
                          <span className="line-clamp-2 text-[15px] leading-snug font-semibold tracking-[-0.012em] text-ink">{p.title}</span>
                          <span className="block truncate text-xs text-ink-tertiary">{ms.length ? `${done} of ${plural(ms.length, "milestone")} complete` : "Schedule coming soon"}</span>
                        </span>
                      </Link>
                    </li>);
                })}
              </ul>
            </section>) : null}
        </>)}
    </div>);
}

/** Where handover stands, said plainly: a countdown, or that the planned date has passed. */
function handover(end: string, today: string): { text: string; late: boolean } {
    const days = daysBetween(today, end);
    if (days > 1)
        return { text: `${days} days to handover`, late: false };
    if (days === 1)
        return { text: "Handover tomorrow", late: false };
    if (days === 0)
        return { text: "Handover today", late: false };
    return { text: `Planned handover ${short(end)} · running late`, late: true };
}

function ProjectTitle({ project: p, className }: {
    project: ProjectWithRelations;
    className: string;
}) {
    return (<h2 id="project-title" className={cn("leading-[1.08] font-semibold tracking-[-0.03em] text-balance", className)}>
      <Link href={projectPath(p.id)} className={cn("rounded-md", focusRing)}>{p.title}</Link>
    </h2>);
}

/** The site itself, leading the page: the newest photo the project manager approved. */
function PhotoHero({ project: p, photo, today }: {
    project: ProjectWithRelations;
    photo: ClientPhoto;
    today: string;
}) {
    const due = handover(p.end_date, today);
    return (<section aria-labelledby="project-title" className="materialize relative isolate mt-5 h-58 overflow-hidden rounded-[24px] shadow-[0_30px_60px_-30px_rgb(60_30_5/0.45)] sm:h-64" style={stagger(2)}>
      <motion.img src={photo.url} alt={`Site photo: ${photo.taskTitle}`} initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0 -z-20 size-full object-cover"/>
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-black/75 via-black/20 to-black/5"/>
      <div className="flex h-full flex-col justify-between p-5 sm:px-7 sm:py-6">
        <span className={cn("inline-flex h-8 items-center gap-1.5 self-end rounded-full px-3.5 text-xs font-medium ring-1 backdrop-blur-md", due.late ? "bg-black/35 text-amber-200 ring-amber-200/40" : "bg-black/35 text-white ring-white/25")}>
          <CalendarRange className="size-3.5" aria-hidden/>
          {due.text}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] text-white/85">{photo.taskTitle} · approved {agoPhrase(isoDateIn(photo.at), today)}</p>
          <ProjectTitle project={p} className="mt-1 text-[1.75rem] text-white sm:text-[2.25rem] [&_a]:focus-visible:ring-white"/>
        </div>
      </div>
    </section>);
}

/** Before any photo is approved: the project's name and handover, quietly, without a stand-in image. */
function TitleBand({ project: p, today }: {
    project: ProjectWithRelations;
    today: string;
}) {
    const due = handover(p.end_date, today);
    return (<section aria-labelledby="project-title" className="materialize mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-[24px] material px-6 py-5 sm:px-7" style={stagger(2)}>
      <div className="min-w-0">
        <ProjectTitle project={p} className="text-[1.5rem] text-ink sm:text-[1.875rem]"/>
        <p className="mt-1 text-sm text-ink-tertiary">Site photos appear here once your project manager approves them.</p>
      </div>
      <span className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium", due.late ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand")}>
        <CalendarRange className="size-3.5" aria-hidden/>
        {due.text}
      </span>
    </section>);
}

/** When the next milestone falls, honest when it is late. */
function nextWhen(m: DashboardMilestone, today: string): { text: string; late: boolean } {
    if (!m.due_date)
        return { text: "Date to be set", late: false };
    const days = daysBetween(today, m.due_date);
    if (days < 0)
        return { text: `Was due ${short(m.due_date)} · ${plural(-days, "day")} late`, late: true };
    if (days === 0)
        return { text: "Due today", late: false };
    if (days === 1)
        return { text: "Due tomorrow", late: false };
    return { text: `Due ${short(m.due_date)} · in ${plural(days, "day")}`, late: false };
}

/**
 * Progress in one glance: a ring and "x of y", how it stands in plain words,
 * one segment per milestone, and the next one with its date, which opens the
 * full timeline. The whole route lives on the project's own Overview.
 */
function Progress({ project: p, milestones, today, className }: {
    project: ProjectWithRelations;
    milestones: DashboardMilestone[];
    today: string;
    className?: string;
}) {
    const delivered = milestones.filter((m) => m.completed).length;
    const next = milestones.find((m) => !m.completed);
    const health = clientHealth(p.status, milestones, today);
    const when = next ? nextWhen(next, today) : null;
    const tone = health.tone === "late" ? "text-danger" : p.status === "on_hold" ? "text-ink-secondary" : "text-success";
    return (<section aria-labelledby="progress-heading" className={cn("materialize rounded-[20px] material p-5 sm:p-6", className)} style={stagger(3)}>
      <div className="flex items-center gap-4">
        <ProgressRing value={milestones.length ? delivered / milestones.length : 0} size={56} stroke={6}>
          <span className="text-[13px] font-semibold text-ink tabular">{delivered}/{milestones.length}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <h2 id="progress-heading" className="text-[13px] text-ink-tertiary">Progress</h2>
          <p className="text-[17px] font-semibold tracking-[-0.016em] text-ink tabular">{milestones.length ? `${delivered} of ${plural(milestones.length, "milestone")}` : "Plan in progress"}</p>
          {milestones.length ? (<p className={cn("flex items-center gap-1.5 text-[13px] font-medium", tone)}>
              <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden/>
              <span className="truncate">{health.text}</span>
            </p>) : null}
        </div>
      </div>

      {milestones.length === 0 ? (<p className="mt-3 text-sm leading-relaxed text-ink-tertiary">Your project manager is setting out the phases of your project. They will appear here as the plan firms up.</p>) : (<>
          <div aria-hidden className="mt-4 flex gap-1">
            {milestones.map((m) => (<span key={m.id} className={cn("h-1.5 flex-1 rounded-full", m.completed ? "bg-copper" : m.due_date && m.due_date < today ? "bg-stage-late" : m.id === next?.id ? "bg-copper/35" : "bg-surface-sunken")}/>))}
          </div>
          <Link href={projectTimelinePath(p.id)} className={cn("group -mx-2 mt-3 flex items-center gap-3 rounded-2xl p-2 transition-colors duration-300 hover:bg-surface-subtle", focusRing)}>
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden><CalendarRange className="size-4.5"/></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-ink">{next ? `Next · ${next.title}` : "Every milestone is delivered"}</span>
              <span className={cn("block truncate text-[13px]", when?.late ? "font-medium text-danger" : "text-ink-tertiary")}>{when ? when.text : "See the full timeline"}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-tertiary transition-transform duration-300 ease-spring group-hover:translate-x-0.5" aria-hidden/>
          </Link>
        </>)}
    </section>);
}

/**
 * Who runs this home, and their latest word on it. The site team is a
 * headcount, since clients deal with the project manager; one wide button
 * answers them.
 */
function ManagerCard({ project: p, lead, today, className }: {
    project: ProjectWithRelations;
    lead: ClientProjectData | null;
    today: string;
    className?: string;
}) {
    const pm = p.pm;
    const name = pm?.full_name ?? "Your project manager";
    const first = pm?.full_name?.split(" ")[0];
    const note = lead?.update ?? null;
    const site = lead ? lead.team.filter((m) => m.role === ROLE_TERMS.middleman).length : 0;
    const unread = useLiveUnread(p.id, lead?.unread ?? 0);
    return (<section aria-labelledby="team-heading" className={cn("materialize rounded-[20px] material p-5 sm:p-6", className)} style={stagger(4)}>
      <div className="flex items-center gap-3">
        {pm ? <Face person={{ id: pm.id, name, avatarUrl: pm.avatar_url, role: ROLE_TERMS.project_manager }} size={44}/> : null}
        <div className="min-w-0 flex-1">
          <h2 id="team-heading" className="truncate text-[15px] font-semibold text-ink">{name}</h2>
          <p className="truncate text-[13px] text-ink-tertiary">Your project manager{site > 0 ? ` · ${site === 1 ? "1 person" : `${site} people`} on site` : ""}</p>
        </div>
      </div>
      {note ? (<figure className="mt-4">
          <blockquote className="line-clamp-5 text-[15px] leading-relaxed text-pretty whitespace-pre-wrap text-ink-secondary">{note.note}</blockquote>
          <figcaption className="mt-1.5 text-xs text-ink-tertiary">Project update · {agoPhrase(isoDateIn(note.at), today)}</figcaption>
        </figure>) : null}
      <OpenChatButton projectId={p.id} aria-label={unread > 0 ? `Message ${name}, ${unread} unread` : `Message ${name}`} className={cn("press mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-sunken text-[15px] font-semibold text-ink transition-colors hover:bg-line [&_svg]:size-4.5", unread > 0 && "bg-brand-soft text-brand hover:bg-brand-soft", focusRing)}>
        <MessageSquare aria-hidden/>
        {first ? `Message ${first}` : "Message"}
        {unread > 0 ? <span aria-hidden className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white tabular">{unread > 9 ? "9+" : unread}</span> : null}
      </OpenChatButton>
    </section>);
}

/** The newest accepted work on the lead project, with what is new since the last visit marked. */
function LeadUpdates({ data, className }: {
    data: ClientProjectData;
    className?: string;
}) {
    const baseline = useVisitBaseline(data.project.id);
    const fresh = new Set(newSince(data.updates, baseline).map((u) => u.id));
    return (<div className={cn("min-w-0", className)} style={stagger(5)}>
      <RecentUpdates projectId={data.project.id} updates={data.updates} milestones={data.milestones} fresh={fresh}/>
    </div>);
}
