"use client";
import * as React from "react";
import Link from "next/link";
import { useLiveUnread } from "@/components/messenger/messenger-store";
import { OpenChatButton } from "@/components/messenger/open-chat-button";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarDays, MessageSquare, Plus } from "lucide-react";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { deadlineHref, NeedsYou } from "@/components/dashboard/needs-you";
import { CountUp } from "@/components/dashboard/count-up";
import { Face, FaceStack, focusRing, OverviewCard, OverviewHeader, primaryAction, ProgressRing, softAction, stagger, trackSpotlight } from "@/components/dashboard/overview-kit";
import { describeStages } from "@/components/system/stage-meter";
import { projectBoardPath, projectPath, projectsListPath, projectTimelinePath, ROUTES } from "@/lib/constants";
import type { ProjectContext, TeamMember } from "@/lib/data/project-context";
import { addDays, centredGrowth, daysBetween, formatDate, openDeadlines, partitionDeadlines, plural, portfolioStages, projectLoads, projectPace, quietWeek, relativeDay, sortByAttention, spanShare, type DashboardMilestone, type DashboardTask, type Deadline, type ProjectLoad } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { assessProjectClosureReadiness } from "@/lib/project-lifecycle";
import { cn } from "@/lib/utils";
import { TASK_STAGE_TERMS } from "@/lib/vocabulary";
import type { ProjectWithRelations } from "@/services/project-service";

/** Days the agenda covers, today first. */
const WEEK_DAYS = 7;
/** At or below this many projects, the tiles stack beside Needs you and the week. */
const FEW_PROJECTS = 2;

type PmDashboardProps = {
    /** "Good morning, Josh", worked out in Manila on the server. */
    greeting: string;
    projects: ProjectWithRelations[];
    /** Finished projects, counted only when none are active. */
    closedCount: number;
    tasks: DashboardTask[];
    milestones: DashboardMilestone[];
    context: ProjectContext;
    loadFailed: boolean;
    /** ISO date (Manila) the server treats as today; overdue is measured against it. */
    today: string;
};

/**
 * The project manager's home. Three parts, each holding its own facts once:
 * projects say how each is going, Needs you holds only what the PM acts on,
 * and the week holds only dates. Pointing at a project shows who works on it.
 */
export function PmDashboard({ greeting, projects, closedCount, tasks, milestones, context, loadFailed, today }: PmDashboardProps) {
    const view = React.useMemo(() => {
        const loads = projectLoads(projects.map((p) => p.id), tasks, milestones, today);
        const { overdue, upcoming } = partitionDeadlines(openDeadlines(tasks, milestones), today, WEEK_DAYS - 1);
        const readyToClose = projects.filter((p) => assessProjectClosureReadiness(p, milestones.filter((m) => m.project_id === p.id), tasks.filter((t) => t.project_id === p.id)).ready);
        const open = openDeadlines(tasks, milestones);
        const lateCount = new Map<string, number>();
        for (const d of overdue)
            lateCount.set(d.project_id, (lateCount.get(d.project_id) ?? 0) + 1);
        return {
            loads, overdue, upcoming, readyToClose, lateCount,
            /** The first deadline beyond the week, for when the week itself is empty. */
            later: open.find((d) => d.due_date > addDays(today, WEEK_DAYS - 1)),
            portfolio: portfolioStages(loads.values()),
            ordered: sortByAttention(projects, loads),
        };
    }, [projects, tasks, milestones, today]);
    const [litProjects, setLitProjects] = React.useState<Set<string> | null>(null);
    const [openTile, setOpenTile] = React.useState<string | null>(null);
    // A tap anywhere outside the open tile closes it (touch has no pointer-leave).
    React.useEffect(() => {
        if (!openTile)
            return;
        const onDown = (e: PointerEvent) => {
            if (!(e.target as Element | null)?.closest(`[data-tile="${openTile}"]`))
                setOpenTile(null);
        };
        document.addEventListener("pointerdown", onDown);
        return () => document.removeEventListener("pointerdown", onDown);
    }, [openTile]);
    const titleOf = (id: string) => projects.find((p) => p.id === id)?.title ?? "Project";
    /** Up to this many projects sit in a column beside their work instead of a row of tiles above it. */
    const few = projects.length <= FEW_PROJECTS;

    return (<div className="mx-auto w-full max-w-360 pb-12">
      <LiveRefresh channel="pm-dashboard"/>

      <OverviewHeader title={greeting} sub={<>
          {formatDate(today, { weekday: "long", month: "long", day: "numeric" })}{projects.length > 0 ? <> · <b>{plural(projects.length, "active project")}</b></> : null}
          {view.portfolio.total > 0 ? <> · <b>{view.portfolio.done} of {view.portfolio.total}</b> tasks accepted</> : null}
        </>} actions={projects.length > 0 ? <NewProject/> : undefined}/>

      {loadFailed ? (<p role="alert" className="mt-6 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          Some task or milestone data could not be loaded, so the figures may be incomplete.{" "}
          <a href={ROUTES.DASHBOARD} className="font-medium underline underline-offset-2">Reload</a>
        </p>) : null}

      {projects.length === 0 ? (<Welcome closedCount={closedCount}/>) : (<div className={cn("mt-8 grid gap-5", few && "lg:grid-cols-[23rem_minmax(0,1fr)] lg:items-start")}>
          <section aria-label="Projects" className={cn("grid gap-5 sm:grid-cols-2", few ? "lg:grid-cols-1" : "xl:grid-cols-4")}>
            {view.ordered.map((p, i) => (<ProjectTile key={p.id} index={i} project={p} load={view.loads.get(p.id)!} milestones={milestones.filter((m) => m.project_id === p.id)} team={context.teams[p.id] ?? []} tasks={tasks.filter((t) => t.project_id === p.id)} unread={context.unread[p.id] ?? 0} today={today} late={view.lateCount.get(p.id) ?? 0} dimmed={!!litProjects && !litProjects.has(p.id)} open={openTile === p.id} receded={openTile !== null && openTile !== p.id} onOpen={() => setOpenTile(p.id)} onClose={() => setOpenTile((id) => (id === p.id ? null : id))}/>))}
          </section>

          {/* Few projects: the work sits beside them. Many: below, in two columns. */}
          <div className={cn("grid items-start gap-5", !few && "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]")}>
            <NeedsYou overdue={view.overdue} projects={projects} loads={view.loads} readyToClose={view.readyToClose} titleOf={titleOf} today={today}/>
            <Week upcoming={view.upcoming} overdue={view.overdue} later={view.later} today={today} titleOf={titleOf} onLight={setLitProjects}/>
          </div>
        </div>)}
    </div>);
}

/* ─────────────────────────── Projects ─────────────────────────── */

/** The tile's one status: its worst true fact first, so a full ring never hides late work. */
function paceOf(project: ProjectWithRelations, load: ProjectLoad, today: string, late: number) {
    const pace = projectPace(project, load, today);
    if (late > 0)
        return { text: `${late} overdue`, dot: "bg-stage-late", tone: "text-danger" };
    if (load.tasksTotal > 0 && pace.work >= 1)
        return { text: "All work accepted", dot: "bg-stage-done", tone: "text-success" };
    switch (pace.state) {
        case "not_started": return { text: `Starts ${formatDate(project.start_date, { month: "short", day: "numeric" })}`, dot: "bg-line-strong", tone: "text-ink-secondary" };
        case "ended": return { text: "Past its end date", dot: "bg-copper", tone: "text-brand" };
        case "behind": return { text: "Behind schedule", dot: "bg-copper", tone: "text-brand" };
        default: return { text: "On pace", dot: "bg-stage-done", tone: "text-ink-secondary" };
    }
}

/** How far an open box comes toward you: the full zoom where the row has room, gentler where the margins are narrow. */
const ZOOM_WIDE = 1.15;
const ZOOM_NARROW = 1.06;
/** On wide screens an open box becomes this many times its resting width (zoom included), growing evenly from its centre. */
const OPEN_WIDTH_RATIO = 1.5;
/** An open box also gains this much height, downward, so its details need little scrolling. */
const OPEN_GROW = 200;
/** Every box's resting height; the open box zooms from the centre of this. */
const REST_HEIGHT = "13.5rem";
const WIDE_QUERY = "(min-width: 1280px)";
const subscribeWide = (onChange: () => void) => {
    const mq = window.matchMedia(WIDE_QUERY);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
};

/** Pointer must rest this long before a box opens, so sweeping across the row stays calm. */
const OPEN_DELAY = 260;
const CLOSE_DELAY = 140;

/**
 * A project as a box. Pointing at it (or tabbing to it) zooms it toward you
 * from its own centre and turns its face to the details: calendar, team,
 * what is next and what happened lately. It never moves or changes size in
 * the layout; the other boxes step back. On touch the first tap opens it.
 */
function ProjectTile({ index, project: p, load, milestones, team, tasks, unread: serverUnread, today, late, dimmed, open, receded, onOpen, onClose }: {
    index: number;
    project: ProjectWithRelations;
    load: ProjectLoad;
    milestones: DashboardMilestone[];
    team: TeamMember[];
    tasks: DashboardTask[];
    /** Messages from others the PM has not read. */
    unread: number;
    today: string;
    /** Open deadlines already past due in this project. */
    late: number;
    dimmed: boolean;
    open: boolean;
    /** Another box is open: this one steps back so the open one is the focus. */
    receded: boolean;
    onOpen: () => void;
    onClose: () => void;
}) {
    const unread = useLiveUnread(p.id, serverUnread);
    const share = load.tasksTotal > 0 ? load.stages.done / load.tasksTotal : 0;
    const pace = paceOf(p, load, today, late);
    const [raised, setRaised] = React.useState(false);
    const timer = React.useRef<number | undefined>(undefined);
    const pointer = React.useRef("mouse");
    const detailsId = `tile-${p.id}-details`;
    const wide = React.useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => true);
    const cellRef = React.useRef<HTMLDivElement>(null);
    const [growth, setGrowth] = React.useState(0);
    // Measured as the box opens: grow evenly from the centre, as wide as the page area allows.
    React.useLayoutEffect(() => {
        const cell = cellRef.current;
        if (!open || !wide || !cell)
            return;
        const slot = cell.getBoundingClientRect();
        const area = (cell.closest("main") ?? document.documentElement).getBoundingClientRect();
        setGrowth(centredGrowth(slot.left, slot.right, area.left + 8, area.right - 8, OPEN_WIDTH_RATIO, ZOOM_WIDE));
    }, [open, wide]);
    const side = open && wide ? growth : 0;

    React.useEffect(() => () => window.clearTimeout(timer.current), []);
    React.useEffect(() => {
        if (open)
            setRaised(true);
    }, [open]);
    const later = (fn: () => void, ms: number) => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(fn, ms);
    };

    // The cell keeps the resting height, so the open box can grow over the cards below without moving them.
    return (<div ref={cellRef} data-tile={p.id} className="materialize relative min-w-0" style={{ ...stagger(index + 1), height: REST_HEIGHT, zIndex: raised ? 30 : undefined }} onPointerEnter={(e) => { pointer.current = e.pointerType; if (e.pointerType === "mouse") later(onOpen, OPEN_DELAY); }} onPointerLeave={(e) => { if (e.pointerType === "mouse") later(onClose, CLOSE_DELAY); }} onPointerDown={(e) => { pointer.current = e.pointerType; }} onFocus={(e) => { if (e.target.matches(":focus-visible")) onOpen(); }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onClose(); }} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <motion.div data-open={open} initial={false} animate={{ scale: open ? (wide ? ZOOM_WIDE : ZOOM_NARROW) : receded ? 0.97 : 1 }} transition={SPRING} onAnimationComplete={() => { if (!open) setRaised(false); }} onPointerMove={trackSpotlight} style={{ transformOrigin: `50% calc(${REST_HEIGHT} / 2)`, height: open ? `calc(${REST_HEIGHT} + ${OPEN_GROW}px)` : REST_HEIGHT, left: -side, right: -side }} className={cn("tile-surface spotlight absolute inset-x-0 top-0 flex flex-col overflow-hidden rounded-[20px] material", dimmed && !open && "opacity-35 saturate-50", receded && !dimmed && "opacity-55 blur-[1.5px] saturate-[.85]")}>

      {/* Front: how the project stands. */}
      <div aria-hidden={open} style={{ height: REST_HEIGHT }} className={cn("flex flex-none flex-col justify-between p-5 transition-[opacity,scale,filter] duration-[450ms] ease-spring", open && "pointer-events-none scale-[0.96] opacity-0 blur-[3px] motion-reduce:scale-100 motion-reduce:blur-none")}>
        <div className="flex items-center gap-4">
          <ProgressRing value={share} done={share >= 1 && late === 0}>
            <span className="text-lg font-semibold tracking-[-0.03em] text-ink tabular"><CountUp value={Math.round(share * 100)} delay={(index + 1) * 70 + 220}/><span className="text-[11px] font-medium text-ink-tertiary">%</span></span>
          </ProgressRing>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-base leading-snug font-semibold tracking-[-0.014em] text-ink">
              <Link href={projectPath(p.id)} aria-describedby={detailsId} onClick={(e) => { if (pointer.current === "touch" && !open) { e.preventDefault(); onOpen(); } }} className="outline-none after:absolute after:inset-0 after:rounded-[20px]">{p.title}</Link>
            </h3>
            <p className="mt-0.5 truncate text-xs text-ink-tertiary">{p.client?.full_name ?? "No client yet"}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", pace.tone)}>
            <span className={cn("size-1.5 rounded-full", pace.dot)} aria-hidden/>
            {pace.text}
          </span>
          {team.length > 0 ? <FaceStack people={team} max={3} size={24}/> : null}
        </div>
      </div>

      {/* Back: the details, in the same footprint. */}
      <div id={detailsId} inert={!open} className={cn("absolute inset-0 flex min-h-0 flex-col p-4 transition-[opacity,translate,filter] duration-[450ms] ease-spring", open ? "delay-75" : "pointer-events-none translate-y-1.5 opacity-0 blur-[3px]")}>
        <div className="flex items-center gap-3 px-1">
          <ProgressRing value={share} done={share >= 1 && late === 0} size={34} stroke={4} glow={open}>
            <span className="text-[9px] font-semibold text-ink tabular">{Math.round(share * 100)}</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-[-0.012em] text-ink">{p.title}</p>
            <p className={cn("truncate text-[11px] font-medium", pace.tone)}>{pace.text}</p>
          </div>
          {unread > 0 ? (<OpenChatButton projectId={p.id} aria-label={`${plural(unread, "unread message")}`} className={cn("press relative grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand hover:bg-brand hover:text-white", focusRing)}>
              <MessageSquare className="size-3.5" aria-hidden/>
              <span aria-hidden className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-semibold text-white ring-2 ring-surface tabular">{unread > 9 ? "9+" : unread}</span>
            </OpenChatButton>) : null}
          <Link href={projectPath(p.id)} className={cn("press inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-brand px-3 text-xs font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_6px_14px_-6px_rgb(180_83_9/0.55)] hover:bg-brand-hover", focusRing)}>
            Open
            <ArrowUpRight className="size-3.5" aria-hidden/>
          </Link>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-3 [mask-image:linear-gradient(to_bottom,black_calc(100%-1rem),transparent)] [scrollbar-width:thin]">
          <TileDetails project={p} milestones={milestones} team={team} tasks={tasks} unread={unread} today={today}/>
        </div>
      </div>
      <p className="sr-only">{describeStages(load.stages, load.tasksTotal)}.</p>
      </motion.div>
    </div>);
}

const detailLabel = "text-[10px] font-semibold tracking-[0.07em] text-ink-tertiary uppercase";
const tileChip = cn(softAction, "h-7 px-3 text-xs");

/** Tasks someone is working on or waiting to be accepted, the newest movement first. */
function inMotion(tasks: DashboardTask[]) {
    return tasks.filter((t) => t.stage === "in_progress" || t.stage === "review").sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
/** Work in motion rows shown before "more on the board". */
const MOTION_LIMIT = 4;

/** What an open box shows, in reading order: calendar, team, next milestone, then work in motion and links as you scroll. */
function TileDetails({ project: p, milestones, team, tasks, unread, today }: {
    project: ProjectWithRelations;
    milestones: DashboardMilestone[];
    team: TeamMember[];
    tasks: DashboardTask[];
    unread: number;
    today: string;
}) {
    const moving = inMotion(tasks);
    const nameOf = (id: string | null | undefined) => (id ? team.find((m) => m.id === id)?.name.split(" ")[0] ?? "A former member" : "Unassigned");
    const next = milestones.filter((m) => !m.completed && m.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
    const elapsed = spanShare(p.start_date, p.end_date, today);
    const left = daysBetween(today, p.end_date);
    const calendar = today < p.start_date ? `Starts in ${plural(daysBetween(today, p.start_date), "day")}` : left >= 0 ? `${plural(left, "day")} left` : `${plural(-left, "day")} past its end`;
    return (<div className="grid gap-4">
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h4 className={detailLabel}>Calendar</h4>
          <p className={cn("text-[11px] font-medium tabular", left < 0 ? "text-brand" : "text-ink")}>{calendar}</p>
        </div>
        <div className="relative mt-2 h-1 rounded-full bg-surface-sunken" aria-hidden>
          <span className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-copper/20 to-copper/70" style={{ width: `${elapsed * 100}%` }}/>
          {today >= p.start_date && today <= p.end_date ? <span className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-copper" style={{ left: `${elapsed * 100}%` }}/> : null}
        </div>
        <p className="mt-1 flex justify-between text-[10px] text-ink-tertiary tabular">
          <span>{formatDate(p.start_date, { month: "short", day: "numeric" })}</span>
          <span>{formatDate(p.end_date, { month: "short", day: "numeric", year: "numeric" })}</span>
        </p>
      </section>

      <section>
        <h4 className={detailLabel}>Team</h4>
        {team.length === 0 ? <p className="mt-1.5 text-xs text-ink-tertiary">No one has joined yet.</p> : (<ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
            {team.map((m) => (<li key={m.id} className="flex min-w-0 items-center gap-2">
                <Face person={m} size={24}/>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-xs font-medium text-ink">{m.name}</span>
                  <span className="block truncate text-[10px] text-ink-tertiary">{m.role}</span>
                </span>
              </li>))}
          </ul>)}
      </section>

      <section>
        <h4 className={detailLabel}>Next milestone</h4>
        {next ? (<p className="mt-1.5 flex items-start gap-2 text-xs">
            <span className="mt-1 size-1.5 shrink-0 rotate-45 rounded-[1px] bg-copper" aria-hidden/>
            <span className="min-w-0">
              <span className="block font-medium text-ink">{next.title}</span>
              <span className={cn("block text-[10px]", next.due_date < today ? "text-danger" : "text-ink-tertiary")}>{next.due_date < today ? `${plural(daysBetween(next.due_date, today), "day")} late` : relativeDay(next.due_date, today)}</span>
            </span>
          </p>) : <p className="mt-1.5 text-xs text-ink-tertiary">No milestone ahead.</p>}
      </section>

      <section>
        <h4 className={detailLabel}>Work in motion</h4>
        {moving.length === 0 ? <p className="mt-1.5 text-xs text-ink-tertiary">Nothing is in progress or waiting for review.</p> : (<ul className="mt-2 grid gap-2">
            {moving.slice(0, MOTION_LIMIT).map((t) => {
                const review = t.stage === "review";
                return (<li key={t.id} className="flex items-start gap-2.5 text-xs">
                  <span aria-hidden className={cn("mt-1 size-[7px] shrink-0 rounded-full", review ? "bg-stage-review" : "bg-stage-progress")}/>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{t.title}</span>
                    <span className="block truncate text-[10px] text-ink-tertiary">{nameOf(t.assigned_to)} · <span className={review ? "text-warning" : undefined}>{TASK_STAGE_TERMS[t.stage].label}</span></span>
                  </span>
                </li>);
            })}
            {moving.length > MOTION_LIMIT ? (<li>
                <Link href={projectBoardPath(p.id)} className={cn("rounded-sm pl-[17px] text-[11px] font-medium text-brand hover:underline", focusRing)}>{moving.length - MOTION_LIMIT} more on the board</Link>
              </li>) : null}
          </ul>)}
      </section>

      <div className="flex flex-wrap gap-1.5">
        <Link href={projectBoardPath(p.id)} className={tileChip}>Board</Link>
        <OpenChatButton projectId={p.id} className={tileChip}>
          Messages
          {unread > 0 ? <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-white tabular">{unread > 9 ? "9+" : unread}</span> : null}
        </OpenChatButton>
        <Link href={projectTimelinePath(p.id)} className={tileChip}>Timeline</Link>
      </div>
    </div>);
}

/* ─────────────────────────── Week ─────────────────────────── */

function NewProject() {
    return (<Link href={`${ROUTES.PROJECTS}/new`} className={primaryAction}>
      <Plus className="transition-transform duration-300 group-hover/action:rotate-90" aria-hidden/>
      New project
    </Link>);
}

const FIRST_STEPS = [
    { title: "Create the project", body: "Name it, set its dates and lay out its milestones." },
    { title: "Invite the people", body: "Bring in the client and the middlemen who will do the work." },
    { title: "Run it from here", body: "Progress, reviews and deadlines gather on this page." },
];

/** No active projects: one clear way in, or a pointer to the finished ones. */
function Welcome({ closedCount }: {
    closedCount: number;
}) {
    return (<section aria-labelledby="welcome-heading" className="materialize mx-auto mt-14 max-w-3xl text-center" style={stagger(1)}>
      <h2 id="welcome-heading" className="text-[1.625rem] leading-tight font-semibold tracking-[-0.03em] text-ink">
        {closedCount > 0 ? "All your projects are closed" : "Set up your first project"}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-secondary">
        {closedCount > 0
            ? <>Nothing is in progress right now. Your {plural(closedCount, "finished project")} {closedCount === 1 ? "is" : "are"} still on record.</>
            : "Everything you manage starts here: your projects, the people on them, and what needs you each day."}
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <NewProject/>
        {closedCount > 0 ? <Link href={projectsListPath("completed")} className={softAction}>View finished projects</Link> : null}
      </div>
      {closedCount === 0 ? (<ol className="mt-12 grid gap-4 text-left sm:grid-cols-3">
          {FIRST_STEPS.map((step, i) => (<li key={step.title} className="materialize rounded-[20px] material px-5 py-5" style={stagger(i + 2)}>
              <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand tabular" aria-hidden>{i + 1}</span>
              <p className="mt-4 text-sm font-semibold text-ink">{step.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{step.body}</p>
            </li>))}
        </ol>) : null}
    </section>);
}

/** The week when nothing is due in it, as one line. */
function QuietWeekLine({ quiet, today, titleOf }: {
    quiet: ReturnType<typeof quietWeek>;
    today: string;
    titleOf: (id: string) => string;
}) {
    const frame = "materialize flex min-w-0 items-center gap-3 rounded-[20px] material px-5 py-4 sm:px-6";
    const label = `Next ${WEEK_DAYS} days`;
    if (quiet.kind === "next") {
        const d = quiet.deadline;
        return (<Link href={deadlineHref(d)} aria-label={`${label}: nothing due. Next up, ${d.title}`} className={cn(frame, "group transition-colors duration-300 ease-spring hover:bg-surface-subtle", focusRing)} style={stagger(7)}>
          <CalendarDays className="size-4 shrink-0 text-ink-tertiary" aria-hidden/>
          <span className="min-w-0 flex-1 truncate text-sm text-ink-secondary">
            Nothing due this week · <span className="font-medium text-ink transition-colors group-hover:text-brand">Next up: {d.title}</span>
            <span className="text-ink-tertiary"> · {titleOf(d.project_id)}</span>
          </span>
          <span className="shrink-0 text-xs font-medium text-ink tabular">{relativeDay(d.due_date, today)}<span className="font-normal text-ink-tertiary"> · in {plural(daysBetween(today, d.due_date), "day")}</span></span>
        </Link>);
    }
    if (quiet.kind === "stalled") {
        const [first] = quiet.projects;
        const one = quiet.projects.length === 1;
        return (<section aria-label={label} className={frame} style={stagger(7)}>
          <CalendarDays className="size-4 shrink-0 text-brand" aria-hidden/>
          <p className="min-w-0 flex-1 text-sm text-ink-secondary">
            <span className="font-medium text-ink">No upcoming dates.</span>{" "}
            {one
                ? <>{titleOf(first.project_id)} has {plural(first.late, "overdue item")} and nothing scheduled after {first.late === 1 ? "it" : "them"}.</>
                : <>{quiet.projects.length} projects have overdue work and nothing scheduled after it.</>}
          </p>
          {one ? (<Link href={projectTimelinePath(first.project_id)} className={cn(softAction, "shrink-0")}>
              Timeline
              <ArrowUpRight aria-hidden/>
            </Link>) : null}
        </section>);
    }
    return (<section aria-label={label} className={frame} style={stagger(7)}>
      <CalendarDays className="size-4 shrink-0 text-ink-tertiary" aria-hidden/>
      <p className="text-sm text-ink-secondary">Nothing scheduled in the next {WEEK_DAYS} days.</p>
    </section>);
}

function Week({ upcoming, overdue, later, today, titleOf, onLight }: {
    upcoming: Deadline[];
    overdue: Deadline[];
    later: Deadline | undefined;
    today: string;
    titleOf: (id: string) => string;
    /** Lights the projects a chosen day touches; null lights every project. */
    onLight: (ids: Set<string> | null) => void;
}) {
    const days = React.useMemo(() => Array.from({ length: WEEK_DAYS }, (_, i) => addDays(today, i)), [today]);
    const byDay = React.useMemo(() => new Map(days.map((d) => [d, upcoming.filter((u) => u.due_date === d)])), [days, upcoming]);
    const [selected, setSelected] = React.useState(() => days.find((d) => byDay.get(d)!.length > 0) ?? today);
    const [chosen, setChosen] = React.useState(false);
    const cells = React.useRef<(HTMLButtonElement | null)[]>([]);
    const items = byDay.get(selected) ?? [];

    function choose(iso: string) {
        // Choosing the lit day again puts every project back.
        const again = chosen && iso === selected;
        setSelected(iso);
        setChosen(!again);
        const ids = new Set(byDay.get(iso)!.map((d) => d.project_id));
        onLight(again || ids.size === 0 ? null : ids);
    }

    function onKeyDown(e: React.KeyboardEvent, i: number) {
        const step = ({ ArrowRight: 1, ArrowLeft: -1 } as Record<string, number>)[e.key];
        if (!step)
            return;
        e.preventDefault();
        const j = Math.min(Math.max(i + step, 0), days.length - 1);
        cells.current[j]?.focus();
        choose(days[j]);
    }

    // An empty week is one slim line, not a card of blank days: what comes next,
    // or the plain fact that late work has nothing scheduled after it.
    if (upcoming.length === 0)
        return <QuietWeekLine quiet={quietWeek(overdue, later)} today={today} titleOf={titleOf}/>;

    return (<OverviewCard id="week-heading" title={`Next ${WEEK_DAYS} days`} aside={<span className="tabular">{formatDate(days[0], { month: "short", day: "numeric" })} to {formatDate(days[WEEK_DAYS - 1], { month: "short", day: "numeric" })}</span>} className="materialize" style={stagger(7)}>
      <div role="group" aria-label="Choose a day" className="grid grid-cols-7 gap-1 px-3 pt-1 sm:px-4">
        {days.map((iso, i) => {
            const dayItems = byDay.get(iso)!;
            const isSelected = iso === selected;
            return (<button key={iso} ref={(el) => { cells.current[i] = el; }} type="button" tabIndex={isSelected ? 0 : -1} aria-pressed={isSelected} aria-label={`${formatDate(iso, { weekday: "long", month: "long", day: "numeric" })}, ${dayItems.length ? plural(dayItems.length, "deadline") : "nothing due"}`} onClick={() => choose(iso)} onKeyDown={(e) => onKeyDown(e, i)} className={cn("press flex cursor-pointer flex-col items-center gap-1 rounded-2xl py-2.5 hover:bg-surface-sunken", focusRing)}>
                <span className="text-[11px] font-medium tracking-[0.04em] text-ink-tertiary uppercase">{formatDate(iso, { weekday: "short" })}</span>
                <span className={cn("relative grid size-9 place-items-center rounded-full text-lg font-medium tracking-[-0.02em] tabular transition-colors duration-300 ease-spring", isSelected ? "text-white" : iso === today ? "text-brand" : "text-ink")}>
                  {isSelected ? <motion.span layoutId="pm-week-day" transition={SPRING} className={cn("absolute inset-0 rounded-full", iso === today ? "bg-brand" : "bg-ink")} aria-hidden/> : null}
                  <span className="relative">{formatDate(iso, { day: "numeric" })}</span>
                </span>
                <span className="flex h-1.5 gap-[3px]" aria-hidden>
                  {dayItems.slice(0, 4).map((d) => <span key={`${d.kind}-${d.id}`} className={cn("size-1.5 rounded-full", d.kind === "milestone" ? "bg-copper" : "bg-ink-tertiary")}/>)}
                </span>
              </button>);
        })}
      </div>

      <div className="px-5 pt-3 pb-4 sm:px-6" aria-live="polite">
        <p className="text-xs font-semibold text-ink">{relativeDay(selected, today)}</p>
        {items.length === 0 ? <p className="py-2 text-sm text-ink-tertiary">Nothing due.</p> : (<ul>
            {items.map((d) => (<li key={`${d.kind}-${d.id}`} className="border-t border-line first:border-t-0">
                <Link href={deadlineHref(d)} className={cn("group flex items-center gap-3 rounded-md py-2.5 text-sm", focusRing)}>
                  <span className={cn("size-2 shrink-0", d.kind === "milestone" ? "rotate-45 rounded-[2px] bg-copper" : "rounded-full border-[1.5px] border-ink-tertiary")} aria-hidden/>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink transition-colors group-hover:text-brand">{d.title}</span>
                  <span className="max-w-[50%] shrink-0 truncate text-xs text-ink-tertiary">{titleOf(d.project_id)}</span>
                </Link>
              </li>))}
          </ul>)}
      </div>
    </OverviewCard>);
}
