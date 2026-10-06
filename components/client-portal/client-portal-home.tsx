"use client";
import * as React from "react";
import Link from "next/link";
import { OpenChatButton } from "@/components/messenger/open-chat-button";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarRange, Check, HardHat, MessageSquare } from "lucide-react";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { Face, focusRing, OverviewCard, ProgressRing, softAction, stagger, trackSpotlight } from "@/components/dashboard/overview-kit";
import { projectPath, projectTimelinePath, ROUTES } from "@/lib/constants";
import { agoPhrase, daysBetween, formatDate, isoDateIn, plural, type DashboardMilestone } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import type { ProjectWithRelations } from "@/services/project-service";

/** Milestones shown at once: the current one with two either side; the rest open on request. */
const STEPS_SHOWN = 5;
/** Approved photos shown beside the progress, after the one leading the page. */
const MORE_PHOTOS = 4;

export type SitePhoto = {
    url: string;
    /** The approved work the photo belongs to. */
    caption: string | null;
    /** When the PM approved it for the client. */
    at: string;
};

type ClientPortalHomeProps = {
    firstName: string;
    /** "Good morning" and so on, worked out in Manila on the server. */
    greeting: string;
    /** ISO date (Manila). */
    today: string;
    /** Active projects the client belongs to; the first leads the page. */
    projects: ProjectWithRelations[];
    milestones: DashboardMilestone[];
    /** The lead project's site photos the PM approved for the client, newest first. */
    photos: SitePhoto[];
    /** Messages on the lead project the client has not read. */
    /** Middlemen on the featured project; null when it couldn't be read. */
    siteCount: number | null;
    /** Pending project invitations, shown under the greeting. */
    notice?: React.ReactNode;
};

const byDue = (a: DashboardMilestone, b: DashboardMilestone) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");

/**
 * The client's home: their space taking shape. The project is the headline,
 * a site photo leads when the PM has approved one, progress is told in
 * milestones (the phases a client recognises, never internal tasks), and the
 * project manager is one tap away. Every fact appears once.
 */
export function ClientPortalHome({ firstName, greeting, today, projects, milestones, photos, siteCount, notice }: ClientPortalHomeProps) {
    const featured = projects[0];
    const others = projects.slice(1);
    const own = featured ? milestones.filter((m) => m.project_id === featured.id).sort(byDue) : [];
    const [lead, ...rest] = photos;

    return (<div className="mx-auto w-full max-w-6xl pb-8">
      <LiveRefresh channel="client-overview"/>

      <h1 className="materialize text-sm text-ink-secondary">
        <span className="font-medium text-ink">{greeting}, {firstName}</span>
        <span className="text-ink-tertiary"> · {formatDate(today, { weekday: "long", month: "long", day: "numeric" })}</span>
      </h1>

      {notice ? <div className="materialize mt-5" style={stagger(1)}>{notice}</div> : null}

      {!featured ? (<div className="materialize mt-5 max-w-xl rounded-[20px] material px-7 py-8" style={stagger(1)}>
          <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-ink">Your project will appear here</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">Once your project manager adds you to a project, you&apos;ll see its progress, photos from the site and a direct line to your project manager.</p>
          <Link href={ROUTES.PROJECTS} className={cn(softAction, "mt-5")}>See past projects</Link>
        </div>) : (<>
          {lead ? <PhotoHero project={featured} photo={lead} today={today}/> : <TitleBand project={featured} today={today}/>}

          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Progress project={featured} milestones={own} today={today}/>
            <div className="grid gap-5">
              <TeamCard project={featured} siteCount={siteCount}/>
              {rest.length > 0 ? <MorePhotos photos={rest.slice(0, MORE_PHOTOS)} today={today}/> : null}
            </div>
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
    return { text: `Planned handover ${formatDate(end, { month: "short", day: "numeric" })} · running late`, late: true };
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
    photo: SitePhoto;
    today: string;
}) {
    const due = handover(p.end_date, today);
    return (<section aria-labelledby="project-title" className="materialize relative isolate mt-4 h-[14rem] overflow-hidden rounded-[24px] shadow-[0_30px_60px_-30px_rgb(60_30_5/0.45)] sm:h-[15rem]" style={stagger(2)}>
      <motion.img src={photo.url} alt={photo.caption ? `Site photo: ${photo.caption}` : "Latest site photo"} initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0 -z-20 size-full object-cover"/>
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-black/75 via-black/20 to-black/5"/>
      <div className="flex h-full flex-col justify-between p-5 sm:px-7 sm:py-6">
        <span className={cn("inline-flex h-8 items-center gap-1.5 self-end rounded-full px-3.5 text-xs font-medium ring-1 backdrop-blur-md", due.late ? "bg-black/35 text-amber-200 ring-amber-200/40" : "bg-white/15 text-white ring-white/25")}>
          <CalendarRange className="size-3.5" aria-hidden/>
          {due.text}
        </span>
        <div className="min-w-0">
          <ProjectTitle project={p} className="text-[1.75rem] text-white sm:text-[2.25rem] [&_a]:focus-visible:ring-white"/>
          <p className="mt-1.5 truncate text-sm text-white/80">{photo.caption ? `${photo.caption} · ` : ""}approved {agoPhrase(isoDateIn(photo.at), today)}</p>
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
    return (<section aria-labelledby="project-title" className="materialize mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-[24px] material px-6 py-5 sm:px-7" style={stagger(2)}>
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

function whenFromNow(iso: string, today: string) {
    const days = daysBetween(today, iso);
    return days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
}

/** The project as a short journey of milestones: what is done, what is next, what follows, and what is late. */
function Progress({ project: p, milestones, today }: {
    project: ProjectWithRelations;
    milestones: DashboardMilestone[];
    today: string;
}) {
    const [all, setAll] = React.useState(false);
    const delivered = milestones.filter((m) => m.completed).length;
    const next = milestones.find((m) => !m.completed);
    const at = next ? milestones.indexOf(next) : milestones.length - 1;
    const start = all ? 0 : Math.max(0, Math.min(at - 2, milestones.length - STEPS_SHOWN));
    const shown = all ? milestones : milestones.slice(start, start + STEPS_SHOWN);
    return (<OverviewCard id="progress-heading" title="Progress" aside={milestones.length ? <span className="tabular">{delivered} of {plural(milestones.length, "milestone")} complete</span> : undefined} className="materialize" style={stagger(3)}>
      <div className="px-5 pb-5 sm:px-6">
        {milestones.length === 0 ? <p className="pt-1 text-sm leading-relaxed text-ink-tertiary">Your project manager is setting out the phases of your project. They will appear here as the plan firms up.</p> : (<>
            <ol className="relative mt-2">
              {shown.map((m, i) => {
                const isNext = m.id === next?.id;
                const late = !m.completed && !!m.due_date && m.due_date < today;
                return (<li key={m.id} className="relative flex gap-3.5 pb-3.5 last:pb-0">
                    {i < shown.length - 1 ? <span aria-hidden className={cn("absolute top-6 bottom-0 left-[11px] w-0.5 rounded-full", m.completed ? "bg-copper/60" : "bg-line")}/> : null}
                    <span aria-hidden className={cn("relative grid size-6 shrink-0 place-items-center rounded-full", m.completed ? "bg-copper text-white" : isNext ? "border-2 border-copper bg-surface" : "border-2 border-line-strong bg-surface")}>
                      {m.completed ? <Check className="size-3" strokeWidth={3}/> : isNext ? (<>
                          <span className="size-2 rounded-full bg-copper"/>
                          <span className="absolute inset-0 animate-ping rounded-full border-2 border-copper/40 [animation-duration:2.4s] motion-reduce:animate-none"/>
                        </>) : null}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
                      <p className={cn("text-sm leading-6 font-medium", m.completed ? "text-ink-secondary" : "text-ink")}>{m.title}</p>
                      <p className={cn("text-xs", m.completed ? "text-success" : late ? "font-medium text-warning" : isNext ? "font-medium text-brand" : "text-ink-tertiary")}>
                        {m.completed ? "Complete" : !m.due_date ? "Date to be set" : late ? `Late · was due ${formatDate(m.due_date, { month: "short", day: "numeric" })}` : isNext ? `Next · ${whenFromNow(m.due_date, today)}` : formatDate(m.due_date, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </li>);
            })}
            </ol>
            <div className="mt-4 flex items-center justify-between gap-3">
              {milestones.length > STEPS_SHOWN ? (<button type="button" aria-expanded={all} onClick={() => setAll((v) => !v)} className={cn("cursor-pointer rounded-sm text-xs font-medium text-ink-secondary hover:text-ink", focusRing)}>
                  {all ? "Show fewer" : `Show all ${milestones.length}`}
                </button>) : <span/>}
              <Link href={projectTimelinePath(p.id)} className={cn("inline-flex items-center gap-0.5 rounded-sm text-xs font-medium text-ink-secondary hover:text-ink", focusRing)}>Full timeline<ArrowUpRight className="size-3.5" aria-hidden/></Link>
            </div>
          </>)}
      </div>
    </OverviewCard>);
}

/**
 * Who works on this home. The project manager is named and one tap away; the
 * site team is a headcount, since clients deal with the project manager.
 */
function TeamCard({ project: p, siteCount }: {
    project: ProjectWithRelations;
    /** Middlemen on the project; null when it couldn't be read. */
    siteCount: number | null;
}) {
    const pm = p.pm;
    const name = pm?.full_name ?? "Your project manager";
    return (<OverviewCard id="team-heading" title="Your team" className="materialize" style={stagger(4)}>
      <div className="px-5 pb-5 sm:px-6">
        <div className="flex items-center gap-3">
          {pm ? <Face person={{ id: pm.id, name, avatarUrl: pm.avatar_url, role: "Project manager" }} size={40}/> : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="text-xs text-ink-tertiary">Project manager</p>
          </div>
          <OpenChatButton projectId={p.id} aria-label={`Message ${name}`} className={cn(softAction, "shrink-0")}>
            <MessageSquare aria-hidden/>
            Message
          </OpenChatButton>
        </div>
        {siteCount !== null ? (<div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-sunken text-ink-secondary" aria-hidden>
              <HardHat className="size-[18px]"/>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{siteCount > 0 ? `${siteCount === 1 ? "1 person" : `${siteCount} people`} on site` : "Site team not assigned yet"}</p>
              <p className="text-xs text-ink-tertiary">{siteCount > 0 ? "Coordinated by your project manager" : "Your project manager assigns them"}</p>
            </div>
          </div>) : null}
      </div>
    </OverviewCard>);
}

/** The approved photos after the one leading the page. */
function MorePhotos({ photos, today }: {
    photos: SitePhoto[];
    today: string;
}) {
    return (<OverviewCard id="photos-heading" title="From the site" count={photos.length} className="materialize" style={stagger(5)}>
      <ul className="grid grid-cols-2 gap-2 px-4 pb-4">
        {photos.map((ph) => (<li key={ph.url}>
            <a href={ph.url} target="_blank" rel="noopener noreferrer" title={ph.caption ?? undefined} className={cn("group press relative block aspect-[4/3] overflow-hidden rounded-xl bg-surface-sunken", focusRing)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- approved site photo from storage */}
              <img src={ph.url} alt={ph.caption ? `Site photo: ${ph.caption}` : "Site photo"} className="size-full object-cover transition-[scale] duration-500 ease-spring group-hover:scale-105"/>
              <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-2 pt-4 pb-1.5 text-[10px] font-medium text-white">{agoPhrase(isoDateIn(ph.at), today).replace(/^./, (c) => c.toUpperCase())}</span>
            </a>
          </li>))}
      </ul>
    </OverviewCard>);
}
