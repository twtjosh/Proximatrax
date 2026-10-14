"use client";
import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Camera, Check, MessageSquare, Send } from "lucide-react";
import { Face, ProgressRing, trackSpotlight } from "@/components/dashboard/overview-kit";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_TERMS, TASK_STAGE_TERMS } from "@/lib/vocabulary";

/*
 * What each role sees at each milestone of the demo project. These are
 * drawings of the real screens with example data, never live data.
 */

export const MILESTONES = [
    { title: "Site survey", due: "Mar 3", start: 0, end: 10 },
    { title: "Design approval", due: "Mar 21", start: 8, end: 28 },
    { title: "Fit-out", due: "Apr 30", start: 26, end: 70 },
    { title: "Final review", due: "May 14", start: 68, end: 84 },
    { title: "Handover", due: "May 22", start: 84, end: 92 },
] as const;

const TEAM = [
    { id: "pm", name: "Marco Reyes", avatarUrl: null, role: "Project manager" },
    { id: "c1", name: "Dan Ocampo", avatarUrl: null, role: "Crew" },
    { id: "c2", name: "Lea Santos", avatarUrl: null, role: "Crew" },
    { id: "cl", name: "Your name", avatarUrl: null, role: "Client" },
];

/** A light workspace screen floating on the landing ground. `who` names the role that sees it. */
function Screen({ title, who, children, className }: {
    title: string;
    who: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (<div onPointerMove={trackSpotlight} className={cn("spotlight overflow-hidden rounded-[22px] bg-surface text-ink shadow-land-window", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <span className="text-[13px] font-semibold tracking-[-0.01em]">{title}</span>
        <span className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-[11px] font-medium text-ink-secondary">{who}</span>
      </div>
      {children}
    </div>);
}

/** Children arrive one after another once `play` turns on. */
function useArrive(play: boolean) {
    const reduce = useReducedMotion();
    return (i: number) => ({
        initial: reduce ? false : { opacity: 0, y: 8, filter: "blur(4px)" },
        animate: play || reduce ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined,
        transition: { ...SPRING, duration: 0.6, delay: 0.08 + i * 0.07 },
    } as const);
}

function SetupWindow({ play }: { play: boolean }) {
    const arrive = useArrive(play);
    return (<Screen title="Condo fit-out · New project" who="Project manager">
      <div className="px-5 pt-4 pb-5">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-line-strong" aria-hidden/>
          <span className="text-xs font-medium text-ink-secondary">{PROJECT_STATUS_TERMS.planning.label}</span>
        </div>
        <ol className="mt-4 divide-y divide-line rounded-2xl bg-surface-subtle ring-1 ring-line">
          {MILESTONES.map((m, i) => (<motion.li key={m.title} {...arrive(i)} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="grid size-6 place-items-center rounded-full border-2 border-line text-[11px] font-semibold text-ink-tertiary tabular">{i + 1}</span>
              <span className="font-medium">{m.title}</span>
              <span className="ml-auto text-xs text-ink-tertiary tabular">Due {m.due}</span>
            </motion.li>))}
        </ol>
        <p className="mt-5 text-xs font-medium text-ink-tertiary">Invited</p>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {TEAM.map((p, i) => (<motion.li key={p.id} {...arrive(i + 5)} className="flex items-center gap-2.5 rounded-xl px-1 py-1">
              <Face person={p} size={30}/>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[13px] font-medium">{p.name}</span>
                <span className="block text-[11px] text-ink-tertiary">{p.role}</span>
              </span>
            </motion.li>))}
        </ul>
      </div>
    </Screen>);
}

function ScheduleWindow({ play }: { play: boolean }) {
    const reduce = useReducedMotion();
    const today = 40;
    return (<Screen title="Schedule" who="Everyone on the project">
      <div className="px-5 pt-4 pb-6">
        <div className="relative">
          <div className="grid grid-cols-4 pb-2 pl-[38%] text-[11px] text-ink-tertiary">
            {["March", "April", "May", ""].map((m) => <span key={m || "end"}>{m}</span>)}
          </div>
          <ul className="space-y-2.5">
            {MILESTONES.map((m, i) => {
                const done = i < 2;
                return (<li key={m.title} className="grid grid-cols-[38%_1fr] items-center gap-2 text-[13px]">
                  <span className="truncate font-medium">{m.title}</span>
                  <span className="relative h-6 rounded-md bg-surface-sunken">
                    <motion.span className={cn("absolute inset-y-1 origin-left rounded", done ? "bg-copper" : i === 2 ? "bg-stage-progress" : "bg-stage-todo")} style={{ left: `${m.start}%`, width: `${m.end - m.start}%` }} initial={reduce ? false : { scaleX: 0 }} animate={play || reduce ? { scaleX: 1 } : undefined} transition={{ ...SPRING, duration: 0.8, delay: 0.15 + i * 0.08 }}/>
                  </span>
                </li>);
            })}
          </ul>
          <motion.span aria-hidden className="pointer-events-none absolute top-0 bottom-0 w-0.5 rounded-full bg-copper" style={{ left: `calc(38% + 0.5rem + (62% - 0.5rem) * ${today / 100})` }} initial={reduce ? false : { scaleY: 0 }} animate={play || reduce ? { scaleY: 1 } : undefined} transition={{ ...SPRING, duration: 0.7, delay: 0.6 }}>
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full rounded-full bg-copper px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white">Today</span>
          </motion.span>
        </div>
        <div className="mt-5 flex items-center gap-4 text-[11px] text-ink-tertiary">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-copper" aria-hidden/>Delivered</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-stage-progress" aria-hidden/>{TASK_STAGE_TERMS.in_progress.label}</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-stage-todo" aria-hidden/>Upcoming</span>
        </div>
      </div>
    </Screen>);
}

const CHECKLIST = ["Mark wall studs", "Hang upper cabinet rail", "Level and fix four units"];

function CrewWindow({ play }: { play: boolean }) {
    const reduce = useReducedMotion();
    const [ticked, setTicked] = useState(reduce ? 2 : 0);
    useEffect(() => {
        if (!play || reduce)
            return;
        const timers = [700, 1300].map((ms, i) => window.setTimeout(() => setTicked(i + 1), ms));
        return () => timers.forEach(clearTimeout);
    }, [play, reduce]);
    return (<div className="mx-auto w-full max-w-[300px] rounded-[40px] bg-[#05070D] p-2.5 shadow-land-window">
      <div className="overflow-hidden rounded-[32px] bg-canvas text-ink">
        <div className="flex items-center justify-between px-5 pt-4 text-[11px] font-semibold"><span className="tabular">8:42</span><span className="h-1.5 w-14 rounded-full bg-ink/80" aria-hidden/><span>Crew</span></div>
        <div className="px-4 pt-4 pb-4">
          <p className="text-[22px] font-semibold tracking-[-0.03em]">Today</p>
          <div className="mt-3 rounded-2xl bg-surface p-4 shadow-card">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-medium text-info"><span className="size-1.5 rounded-full bg-stage-progress" aria-hidden/>{TASK_STAGE_TERMS.in_progress.label}</span>
            <p className="mt-2 text-[15px] font-semibold leading-snug tracking-[-0.01em]">Install kitchen upper cabinets</p>
            <p className="text-xs text-ink-tertiary">Fit-out · due Apr 12</p>
            <ul className="mt-3 space-y-2">
              {CHECKLIST.map((item, i) => {
                    const on = i < ticked;
                    return (<li key={item} className="flex items-center gap-2.5 text-[13px]">
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300 ease-spring", on ? "border-stage-done bg-stage-done text-white" : "border-line-strong")}>
                      {on ? <Check className="size-3" strokeWidth={3} aria-hidden/> : null}
                    </span>
                    <span className={cn("transition-colors duration-300", on && "text-ink-tertiary line-through decoration-line-strong")}>{item}</span>
                  </li>);
                })}
            </ul>
          </div>
          <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
            <span className="grid size-12 place-items-center rounded-2xl bg-surface text-ink shadow-card"><Camera className="size-5" aria-hidden/></span>
            <span className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-semibold text-white">Submit for review<Send className="size-4" aria-hidden/></span>
          </div>
        </div>
      </div>
    </div>);
}

const COLUMNS = [
    { key: "to_do", dot: "bg-stage-todo" },
    { key: "in_progress", dot: "bg-stage-progress" },
    { key: "review", dot: "bg-stage-review" },
    { key: "done", dot: "bg-stage-done" },
] as const;

const BOARD: Record<(typeof COLUMNS)[number]["key"], string[]> = {
    to_do: ["Touch-up paint"],
    in_progress: ["Pendant lights"],
    review: [],
    done: ["Ceiling boards", "Floor tiles"],
};

function ReviewWindow({ play }: { play: boolean }) {
    const reduce = useReducedMotion();
    const cardId = useId();
    const [accepted, setAccepted] = useState(!!reduce);
    useEffect(() => {
        if (!play || reduce)
            return;
        const t = window.setTimeout(() => setAccepted(true), 1100);
        return () => clearTimeout(t);
    }, [play, reduce]);
    const card = (<motion.div layoutId={cardId} transition={SPRING} className={cn("rounded-xl bg-surface p-2.5 text-[12px] font-medium shadow-card", accepted ? "ring-2 ring-stage-done/50" : "ring-2 ring-stage-review/60")}>
      Kitchen upper cabinets
      <span className="mt-1.5 flex items-center gap-1 text-[10.5px] font-normal text-ink-tertiary"><Camera className="size-3" aria-hidden/>3 site photos</span>
    </motion.div>);
    return (<Screen title="Board · Fit-out" who="Project manager">
      <div className="grid grid-cols-4 gap-2 bg-surface-subtle px-3 pt-3 pb-4 max-sm:grid-cols-2">
        {COLUMNS.map((c) => {
                const count = BOARD[c.key].length + ((c.key === "done" ? accepted : c.key === "review" && !accepted) ? 1 : 0);
                return (<div key={c.key} className={cn("min-w-0", (c.key === "to_do" || c.key === "in_progress") && "max-sm:hidden")}>
              <p className="flex items-center gap-1.5 px-1 pb-2 text-[11px] font-medium text-ink-secondary">
                <span className={cn("size-1.5 shrink-0 rounded-full", c.dot)} aria-hidden/>
                <span className="truncate">{TASK_STAGE_TERMS[c.key].label}</span>
                <span className="ml-auto text-ink-tertiary tabular">{count}</span>
              </p>
              <div className="flex min-h-[132px] flex-col gap-1.5 rounded-xl bg-surface-sunken/60 p-1.5">
                {c.key === "review" && !accepted ? card : null}
                {c.key === "done" && accepted ? card : null}
                {BOARD[c.key].map((t) => <div key={t} className="rounded-xl bg-surface p-2.5 text-[12px] font-medium text-ink-secondary shadow-card">{t}</div>)}
              </div>
            </div>);
            })}
      </div>
      <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-[12px]">
        <span className={cn("grid size-5 place-items-center rounded-full transition-colors duration-300", accepted ? "bg-stage-done text-white" : "bg-warning-soft text-warning")}>
          {accepted ? <Check className="size-3" strokeWidth={3} aria-hidden/> : <span className="size-1.5 rounded-full bg-stage-review" aria-hidden/>}
        </span>
        <span className="text-ink-secondary">{accepted ? "Accepted by Marco Reyes. Now visible to the client." : "Waiting on the project manager"}</span>
      </div>
    </Screen>);
}

/** An interior elevation, drawn: the approved fit-out as a line drawing. */
function RoomDrawing() {
    return (<svg viewBox="0 0 320 170" className="h-full w-full" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 140h320" opacity=".5"/>
      <path d="M24 26h118v52H24zM24 52h118M63 26v52M103 26v52" />
      <path d="M24 92h118v48H24zM24 108h118M83 92v48" />
      <path d="M30 86h106" opacity=".5"/>
      <path d="M200 0v34M186 34h28l-5 12h-18z" />
      <path d="M176 104h104v22H176zM180 126v14M276 126v14M172 98c0-6 4-8 8-8h96c4 0 8 2 8 8v12" />
      <path d="M206 90v-8a6 6 0 0 1 6-6h32a6 6 0 0 1 6 6v8" opacity=".6"/>
      <path d="M296 140V64M290 64h12M296 88l-10-8M296 100l10-8" opacity=".6"/>
    </svg>);
}

function ClientWindow({ play }: { play: boolean }) {
    return (<Screen title="Your project" who="Client">
      <div className="px-5 pt-4 pb-5">
        <figure className="relative aspect-[16/8.5] overflow-hidden rounded-2xl bg-brand-soft text-brand">
          <div className="absolute inset-x-6 top-5 bottom-0"><RoomDrawing /></div>
          <figcaption className="absolute top-3 left-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-ink shadow-card">Approved today · Kitchen</figcaption>
        </figure>
        <div className="mt-4 flex items-center gap-4">
          {play ? (<ProgressRing value={0.8} size={64} stroke={6}>
              <span className="text-sm font-semibold tabular">4/5</span>
            </ProgressRing>) : <span className="size-16 shrink-0"/>}
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-[-0.01em]">4 of 5 milestones delivered</p>
            <p className="text-xs text-ink-tertiary">Next: Handover, May 22</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface-subtle p-3 ring-1 ring-line">
          <Face person={TEAM[0]} size={34}/>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[13px] font-medium">Marco Reyes</span>
            <span className="block text-[11px] text-ink-tertiary">Your project manager</span>
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand px-3 text-[12px] font-medium text-white"><MessageSquare className="size-3.5" aria-hidden/>Message</span>
        </div>
      </div>
    </Screen>);
}

export const WINDOWS = [SetupWindow, ScheduleWindow, CrewWindow, ReviewWindow, ClientWindow];
