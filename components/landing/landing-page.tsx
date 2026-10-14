"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, LoaderCircle } from "lucide-react";
import { stagger } from "@/components/dashboard/overview-kit";
import { BrandMark } from "@/components/shell/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { MILESTONES, WINDOWS } from "@/components/landing/journey-windows";
import { ROUTES } from "@/lib/constants";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { COMPANY_NAME, TASK_STAGE_TERMS } from "@/lib/vocabulary";

const ring = "outline-none focus-visible:ring-2 focus-visible:ring-land-accent focus-visible:ring-offset-2 focus-visible:ring-offset-land";
const copperButton = cn("press group/cta inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(120_53_15/0.3),0_12px_28px_-10px_rgb(217_119_6/0.6)] hover:bg-brand-hover disabled:pointer-events-none disabled:opacity-60", ring);
const arrowNudge = "transition-transform duration-300 ease-spring group-hover/cta:translate-x-0.5";

/** Where "today" sits along the demo route: 60% of the way from Design approval to Fit-out. */
const TODAY = 0.25 + 0.6 * 0.25;
/** Today's x as a share of the page column: the route spans the middle 80% (stations are centred in fifths). */
const TODAY_X = `${10 + 80 * TODAY}%`;
const copperLine = "bg-copper shadow-[0_0_16px_rgb(240_160_75/0.5)]";

const SECTIONS = [
    { id: "overview", label: "Overview" },
    { id: "journey", label: "How it runs" },
    { id: "inquire", label: "Start a project" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

/** Where the visitor is: which section owns the reading line, and whether the hero's own starter has scrolled away. */
function useNavState() {
    const { scrollY } = useScroll();
    const [state, setState] = useState<{ scrolled: boolean; section: SectionId; cta: boolean }>({ scrolled: false, section: "overview", cta: false });
    const read = useCallback(() => {
        const line = window.innerHeight * 0.4;
        const top = (id: string) => document.getElementById(id)?.getBoundingClientRect().top ?? Infinity;
        const section: SectionId = top("inquire") < line ? "inquire" : top("journey") < line ? "journey" : "overview";
        const starter = document.getElementById("hero-starter")?.getBoundingClientRect().bottom ?? Infinity;
        const next = { scrolled: window.scrollY > 4, section, cta: starter < 64 && section !== "inquire" };
        setState((s) => (s.scrolled === next.scrolled && s.section === next.section && s.cta === next.cta ? s : next));
    }, []);
    useMotionValueEvent(scrollY, "change", read);
    useEffect(() => {
        const id = requestAnimationFrame(read);
        return () => cancelAnimationFrame(id);
    }, [read]);
    return state;
}

/**
 * A quiet bar that belongs to the page: clear over the hero, frosted with a
 * hairline once content passes under it. The current section carries the
 * pill, and the primary action joins the bar once the hero's own starter has
 * scrolled away.
 */
function NavBar({ onStart }: {
    onStart: () => void;
}) {
    const { scrolled, section, cta } = useNavState();
    const reduce = useReducedMotion();
    return (<header className={cn("fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-500 ease-spring", scrolled ? "border-land-line/80 bg-land/72 backdrop-blur-2xl backdrop-saturate-[1.8]" : "border-transparent bg-transparent")}>
      <nav aria-label="Main" className="mx-auto grid h-16 max-w-[1240px] grid-cols-[1fr_auto_1fr] items-center px-4 max-md:grid-cols-[1fr_auto] sm:px-6">
        <a href="#overview" className={cn("group/brand flex items-center gap-2.5 justify-self-start rounded-xl py-1 pr-1.5", ring)}>
          <BrandMark className="size-8 transition-transform duration-500 ease-spring group-hover/brand:-rotate-12"/>
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-land-ink">ProximaTrax</span>
        </a>
        <ul className="flex items-center gap-0.5 rounded-full bg-land-raised/40 p-1 text-sm ring-1 ring-land-line/70 max-md:hidden">
          {SECTIONS.map((l) => (<li key={l.id}>
              <a href={`#${l.id}`} aria-current={section === l.id ? "location" : undefined} className={cn("relative isolate block rounded-full px-4 py-2 font-medium transition-colors duration-300", section === l.id ? "text-land-ink" : "text-land-ink-2 hover:text-land-ink", ring)}>
                {section === l.id ? <motion.span layoutId="nav-current" aria-hidden className="absolute inset-0 -z-10 rounded-full bg-land-raised shadow-[0_1px_2px_rgb(0_0_0/0.25)] ring-1 ring-land-line" transition={reduce ? { duration: 0 } : SPRING}/> : null}
                {l.label}
              </a>
            </li>))}
        </ul>
        <div className="flex items-center gap-1.5 justify-self-end">
          <ThemeToggle />
          <motion.span layout={!reduce} transition={SPRING}>
            <Link href={ROUTES.LOGIN} prefetch={false} className={cn("press inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-land-ink hover:bg-land-raised max-sm:h-9 max-sm:px-3", ring)}>
              Log in
            </Link>
          </motion.span>
          <AnimatePresence initial={false}>
            {cta ? (<motion.button key="cta" type="button" onClick={onStart} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, x: 8 }} animate={{ opacity: 1, scale: 1, x: 0, transition: SPRING }} exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }} className={cn(copperButton, "ml-0.5 h-10 px-4.5 text-sm max-sm:h-9 max-sm:px-3.5")}>
                <span className="sm:hidden">Inquire</span>
                <span className="max-sm:hidden">Start an inquiry</span>
              </motion.button>) : null}
          </AnimatePresence>
        </div>
      </nav>
    </header>);
}

/** On phones the one labelled station sits just right of the drop, so the line never crosses its text. */
const phoneLabel = "max-sm:overflow-visible max-sm:pl-8 max-sm:text-left max-sm:whitespace-nowrap";

/** What each milestone shows further down, for the station's tooltip. */
const STATION_HINT = ["The project manager sets it up", "One schedule everyone shares", "The crew at work on site", "The PM accepts the work", "Your view of approved progress"];

const goToStop = (i: number) => document.getElementById(`stop-${i}`)?.scrollIntoView({ block: "center" });

/**
 * The demo project's milestones on one copper route, as the app draws them,
 * at hero scale. Each station opens its own stop in the journey below.
 */
function HeroRoute() {
    const reduce = useReducedMotion();
    const n = MILESTONES.length;
    const edge = `${50 / n}%`;
    return (<div className="relative">
      <p className="mb-12 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-sm max-sm:mb-12">
        <span className="font-medium text-land-ink">Condo fit-out, Makati</span>
        <span className="text-land-ink-3">Example project · 2 of 5 milestones delivered</span>
      </p>
      <ol className="relative flex" aria-label="Example project milestones">
        <span aria-hidden className="absolute top-[21px] h-[3px] max-sm:top-[16.5px] rounded-full bg-land-track" style={{ left: edge, right: edge }}>
          <motion.span className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-copper to-brand-bright shadow-[0_0_18px_rgb(240_160_75/0.55)]" initial={reduce ? false : { width: 0 }} animate={{ width: `${TODAY * 100}%` }} transition={{ ...SPRING, duration: 1.6, delay: 0.55 }}/>
        </span>
        <motion.span aria-hidden className="absolute -top-9 z-10 -translate-x-1/2" style={{ left: TODAY_X }} initial={reduce ? false : { opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 1.7 }}>
          <span className="block rounded-full bg-land-ink px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-land">Today · Apr 8</span>
          <span className="mx-auto block h-[22px] w-0.5 bg-copper"/>
        </motion.span>
        {/* The route leaves the schedule at today and drops to the journey below. */}
        <motion.span aria-hidden className={cn("absolute top-[22px] -bottom-24 w-[3px] origin-top -translate-x-1/2 sm:-bottom-32", copperLine)} style={{ left: TODAY_X }} initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ ...SPRING, duration: 1.2, delay: 2 }}/>
        {MILESTONES.map((m, i) => {
            const done = i < 2;
            return (<li key={m.title} className="relative min-w-0 flex-1 text-center">
              <button type="button" onClick={() => goToStop(i)} aria-describedby={`station-hint-${i}`} className={cn("group/station block w-full rounded-2xl pb-1", ring)}>
              <motion.span initial={reduce ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...SPRING, duration: 0.6, delay: 0.6 + i * 0.12 }} className={cn("relative z-10 mx-auto grid size-[45px] place-items-center rounded-full border-2 text-sm font-semibold tabular transition-[scale,border-color,color] duration-300 ease-spring group-hover/station:scale-110 max-sm:size-9", done ? "border-copper bg-copper text-white shadow-[0_0_0_6px_rgb(217_119_6/0.16)]" : "border-land-track bg-land text-land-ink-3 group-hover/station:border-land-ink-3 group-hover/station:text-land-ink")}>
                {done ? <Check className="size-[18px]" strokeWidth={2.5} aria-hidden/> : i + 1}
              </motion.span>
              <span className={cn("mt-3 block truncate px-1 text-sm font-medium text-land-ink max-sm:text-xs", i === 2 ? phoneLabel : "max-sm:sr-only")}>{m.title}</span>
              <span className={cn("block text-xs text-land-ink-3 tabular", i === 2 ? phoneLabel : "max-sm:sr-only")}>{done ? `Delivered ${m.due}` : `Due ${m.due}`}</span>
              <span id={`station-hint-${i}`} role="tooltip" className="pointer-events-none absolute top-[calc(100%+10px)] left-1/2 z-30 w-max max-w-52 -translate-x-1/2 -translate-y-1 rounded-xl bg-land-ink px-3 py-2 text-left text-xs text-land opacity-0 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.45)] transition-[opacity,translate] duration-300 ease-spring group-hover/station:translate-y-0 group-hover/station:opacity-100 group-focus-visible/station:translate-y-0 group-focus-visible/station:opacity-100 max-sm:hidden">
                <span className="block font-semibold">{STATION_HINT[i]}</span>
                <span className="mt-0.5 flex items-center gap-1 opacity-70">See it below<ArrowDown className="size-3" aria-hidden/></span>
              </span>
              </button>
            </li>);
        })}
      </ol>
    </div>);
}

function Hero({ onStart }: {
    onStart: (text: string) => void;
}) {
    const [idea, setIdea] = useState("");
    // Entrance is CSS (.materialize) so the headline paints before hydration.
    return (<section id="overview" className="relative mx-auto max-w-[1240px] px-4 pt-32 pb-24 sm:px-6 sm:pt-36 sm:pb-32">
      <div>
        <h1 className="materialize text-[clamp(2.75rem,6.6vw,5rem)] leading-[1] font-semibold tracking-[-0.035em] text-land-ink max-md:text-balance">
          Watch your space take shape,<br className="max-md:hidden"/> milestone by milestone.
        </h1>
        <p style={stagger(1)} className="materialize mt-7 max-w-[42rem] text-lg leading-relaxed text-pretty text-land-ink-2 sm:text-xl">
          {COMPANY_NAME} designs and builds interiors. On ProximaTrax you follow every approved step, survey to handover, without chasing anyone.
        </p>
        <form id="hero-starter" style={stagger(2)} onSubmit={(e) => {
            e.preventDefault();
            onStart(idea.trim());
        }} className="materialize mt-10 flex max-w-xl items-center gap-2 rounded-full border border-land-line bg-land-raised p-1.5 pl-5 transition-[border-color,box-shadow] duration-300 focus-within:border-land-accent/70 focus-within:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] max-sm:flex-col max-sm:rounded-3xl max-sm:p-2 max-sm:pl-2">
          <label htmlFor="hero-idea" className="sr-only">What are you planning?</label>
          <input id="hero-idea" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="What are you planning?" className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-land-ink caret-copper outline-none placeholder:text-land-ink-3 max-sm:w-full max-sm:px-3"/>
          <button type="submit" className={cn(copperButton, "h-11 px-5 text-sm max-sm:w-full")}>
            Start an inquiry
            <ArrowRight className={cn("size-4", arrowNudge)} aria-hidden/>
          </button>
        </form>
      </div>
      <div style={stagger(3)} className="materialize mt-20 sm:mt-24">
        <HeroRoute />
      </div>
    </section>);
}

const STOPS = [
    { title: "The project opens on day one.", body: "After the site survey, your project manager sets up the project: its milestones, their due dates, and who is on it. You get your own account. There is no public sign-up." },
    { title: "Every milestone has a date you can see.", body: "Design, fit-out and handover sit on one schedule that the whole project shares. When a date moves, everyone sees the same new date." },
    { title: "The crew work from their phones, on site.", body: "Each crew member opens to the task in front of them, its checklist and the camera. Site photos attach to the work they prove." },
    { title: "Nothing counts until the PM accepts it.", body: `Finished work goes to ${TASK_STAGE_TERMS.review.label}. Your project manager checks it, then accepts it or sends it back with a note. Only accepted work reaches you.` },
    { title: "You see progress, not paperwork.", body: "Your portal leads with the newest approved update, counts progress in milestones delivered, and keeps your project manager one tap away." },
];

/** Names the milestone a window belongs to, and says the data is made up. */
function WindowCaption({ index }: {
    index: number;
}) {
    const m = MILESTONES[index]!;
    return (<p className="mt-5 text-center text-xs text-land-ink-3">
      <span className="font-medium text-land-ink-2">{m.title} · <span className="tabular">{m.due}</span></span>
      <span aria-hidden> · </span>Example project; names, dates and tasks are illustrative.
    </p>);
}

function Stop({ index, reached, current, nodeRef }: {
    index: number;
    reached: boolean;
    current: boolean;
    nodeRef: (el: HTMLSpanElement | null) => void;
}) {
    const ref = useRef<HTMLLIElement>(null);
    const seen = useInView(ref, { once: true, margin: "0px 0px -25% 0px" });
    const stop = STOPS[index]!;
    const m = MILESTONES[index]!;
    const Window = WINDOWS[index]!;
    return (<li ref={ref} id={`stop-${index}`} className="relative grid min-h-[72vh] content-center pl-14 max-lg:min-h-0 max-lg:py-14 sm:pl-20">
      <span ref={nodeRef} aria-hidden className={cn("absolute top-1/2 left-0 grid size-9 -translate-y-1/2 place-items-center rounded-full border-2 text-xs font-semibold tabular transition-[background-color,border-color,color,box-shadow] duration-300 ease-spring max-lg:top-[4.5rem] sm:left-1.5", reached ? "border-copper bg-copper text-white shadow-[0_0_0_6px_rgb(217_119_6/0.16)]" : "border-land-track bg-land text-land-ink-3")}>
        {index + 1}
      </span>
      {/* Beside the sticky window, the stop being shown holds focus and the rest step back. */}
      <div className={cn("transition-[opacity,filter] duration-700 ease-spring", !current && "lg:opacity-30 lg:blur-[0.5px]")}>
        <h3 className="max-w-[22ch] text-[clamp(1.75rem,3.2vw,2.6rem)] leading-[1.06] font-semibold tracking-[-0.035em] text-balance text-land-ink">
          <span className="sr-only">{m.title}, due {m.due}: </span>{stop.title}
        </h3>
        <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-pretty text-land-ink-2">{stop.body}</p>
      </div>
      <div className="relative mt-10 -ml-14 sm:-ml-20 lg:hidden">
        <Window play={seen}/>
        <WindowCaption index={index}/>
      </div>
    </li>);
}

/**
 * One scroll position drives the whole route: the copper fill ends at a
 * reading line 80% down the viewport (a stop lights as its heading arrives), a station lights the moment the fill
 * reaches its centre, and the lit station picks the window.
 */
function Journey() {
    const reduce = useReducedMotion();
    const wrapRef = useRef<HTMLDivElement>(null);
    const nodeRefs = useRef<(HTMLSpanElement | null)[]>([]);
    const nodesY = useRef<number[]>([]);
    const top = useRef(0);
    const [trackLen, setTrackLen] = useState(0);
    const [active, setActive] = useState(-1);
    const { scrollY } = useScroll();
    const tip = useMotionValue(0);
    const fill = useTransform(tip, (t) => Math.min(Math.max(t / (nodesY.current.at(-1) || 1), 0), 1));

    const follow = useCallback((y: number) => {
        const t = y + window.innerHeight * 0.8 - top.current;
        tip.set(t);
        setActive(nodesY.current.filter((n) => n <= t + 1).length - 1);
    }, [tip]);
    useMotionValueEvent(scrollY, "change", follow);
    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap)
            return;
        const measure = () => {
            top.current = wrap.getBoundingClientRect().top + window.scrollY;
            nodesY.current = nodeRefs.current.map((n) => (n ? n.getBoundingClientRect().top + n.offsetHeight / 2 + window.scrollY - top.current : 0));
            setTrackLen(nodesY.current.at(-1) ?? 0);
            follow(window.scrollY);
        };
        const observer = new ResizeObserver(measure);
        observer.observe(wrap);
        return () => observer.disconnect();
    }, [follow]);

    const shown = Math.max(active, 0);
    const Window = WINDOWS[shown]!;
    return (<section id="journey" aria-labelledby="journey-title" className="relative scroll-mt-16 border-t border-land-line">
      {/* Along the section edge from today's drop to the gutter, so hero and journey are one route. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 mx-auto max-w-[1240px] px-4 sm:px-6">
        <div className="relative">
          <motion.span className={cn("absolute -top-[2px] left-[17px] h-[3px] w-[calc(var(--x)+1.5px-17px)] origin-right sm:left-[23px] sm:w-[calc(var(--x)+1.5px-23px)]", copperLine)} style={{ "--x": TODAY_X } as React.CSSProperties} initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ ...SPRING, duration: 0.9 }}/>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1240px] gap-16 px-4 pb-28 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pb-16">
        <div ref={wrapRef} className="relative pt-28 sm:pt-36">
          <span aria-hidden className="absolute top-0 left-[17px] w-[3px] rounded-full bg-land-track sm:left-[23px]" style={{ height: trackLen }}>
            <motion.span className="absolute inset-0 origin-top rounded-full bg-copper shadow-[0_0_16px_rgb(240_160_75/0.5)]" style={{ scaleY: fill }}/>
          </span>
          <div className="pl-14 sm:pl-20">
            <h2 id="journey-title" className="max-w-[16ch] text-[clamp(2.25rem,4.6vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-land-ink">
              One route from first visit to handover.
            </h2>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-land-ink-2">
              Here is the example project again, milestone by milestone, and what each person on it sees along the way.
            </p>
          </div>
          <ol className="lg:mt-4">
            {STOPS.map((_, i) => <Stop key={i} index={i} reached={i <= active} current={i === shown} nodeRef={(el) => { nodeRefs.current[i] = el; }}/>)}
          </ol>
        </div>
        <div className="max-lg:hidden">
          <div className="sticky top-[calc(50vh-17rem)] flex min-h-[34rem] flex-col justify-center py-10 lg:mt-[36vh]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={shown} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98, filter: "blur(8px)" }} transition={{ ...SPRING, duration: 0.5 }}>
                <Window play/>
                <WindowCaption index={shown}/>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>);
}

const SERVICES = ["Interior design consultation", "Residential and commercial fit-out", "Renovation and remodelling"];

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error"; message: string };

function Inquiry({ draft, nameRef }: {
    draft: string;
    nameRef: React.RefObject<HTMLInputElement | null>;
}) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState(draft);
    const [status, setStatus] = useState<Status>({ kind: "idle" });
    useEffect(() => {
        if (draft)
            setMessage(draft);
    }, [draft]);
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setStatus({ kind: "sending" });
        try {
            const res = await fetch("/api/inquiries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, message }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error ?? "Your inquiry did not go through.");
            }
            setStatus({ kind: "sent", email });
        }
        catch (err) {
            setStatus({ kind: "error", message: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "We could not reach the server. Check your connection and send it again." });
        }
    }
    const field = "w-full rounded-xl border border-line bg-surface-subtle px-4 text-[15px] text-ink caret-copper transition-[border-color,box-shadow,background-color] duration-300 ease-spring placeholder:text-ink-tertiary hover:border-line-strong focus:border-brand focus:bg-surface focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none";
    return (<section id="inquire" aria-labelledby="inquire-title" className="relative scroll-mt-16 border-t border-land-line">
      <div className="mx-auto grid max-w-[1240px] gap-16 px-4 py-28 sm:px-6 sm:py-36 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
        <div>
          <h2 id="inquire-title" className="max-w-[14ch] text-[clamp(2.25rem,4.6vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-land-ink">
            Every project starts as a message.
          </h2>
          <p className="mt-6 max-w-[32rem] text-lg leading-relaxed text-land-ink-2">
            Tell us about your space. {COMPANY_NAME} handles the whole job: site survey, design planning, fit-out and handover.
          </p>
          <ul className="mt-12 max-w-md border-t border-land-line">
            {SERVICES.map((s) => (<li key={s} className="flex items-center justify-between border-b border-land-line py-4 text-[15px] text-land-ink">
                {s}
                <span className="size-1.5 rounded-full bg-copper" aria-hidden/>
              </li>))}
          </ul>
          <p className="mt-12 text-sm text-land-ink-3">
            Already on a project?{" "}
            <Link href={ROUTES.LOGIN} prefetch={false} className={cn("inline-flex items-center gap-0.5 rounded font-medium text-land-accent underline decoration-land-accent/40 underline-offset-4 hover:decoration-land-accent", ring)}>
              Log in to ProximaTrax<ArrowUpRight className="size-3.5" aria-hidden/>
            </Link>
          </p>
        </div>

        <div className="relative">
          <AnimatePresence mode="wait" initial={false}>
            {status.kind === "sent" ? (<motion.div key="sent" initial={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ ...SPRING, duration: 0.55 }} className="rounded-[22px] bg-surface p-8 text-ink shadow-land-window sm:p-10" role="status">
                <span className="grid size-14 place-items-center rounded-full bg-copper text-white shadow-[0_0_0_8px_rgb(217_119_6/0.14)]">
                  <Check className="size-6" strokeWidth={2.5} aria-hidden/>
                </span>
                <h3 className="mt-7 text-2xl font-semibold tracking-[-0.025em]">Your inquiry is with the team.</h3>
                <p className="mt-3 max-w-sm leading-relaxed text-ink-secondary">
                  {COMPANY_NAME} will reply to <b className="font-medium text-ink">{status.email}</b> to talk through scope, timeline and next steps.
                </p>
                <button type="button" onClick={() => {
                    setStatus({ kind: "idle" });
                    setName("");
                    setEmail("");
                    setMessage("");
                }} className="press mt-8 inline-flex h-10 items-center rounded-full bg-surface-sunken px-5 text-sm font-medium text-ink outline-none hover:bg-line focus-visible:ring-2 focus-visible:ring-brand">
                  Send another inquiry
                </button>
              </motion.div>) : (<motion.form key="form" exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }} transition={{ duration: 0.2 }} onSubmit={handleSubmit} className="space-y-5 rounded-[22px] bg-surface p-6 text-ink shadow-land-window sm:p-9">
                <div className="flex items-center justify-between gap-3 pb-1">
                  <h3 className="text-lg font-semibold tracking-[-0.02em]">New inquiry</h3>
                  <span className="flex items-center gap-1.5 text-xs text-ink-tertiary"><span className="size-1.5 rounded-full bg-stage-todo" aria-hidden/>Replies by email</span>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="inquiry-name" className="block text-sm font-medium text-ink-secondary">Full name</label>
                    <input ref={nameRef} id="inquiry-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required className={cn(field, "h-12")}/>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="inquiry-email" className="block text-sm font-medium text-ink-secondary">Email</label>
                    <input id="inquiry-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className={cn(field, "h-12")}/>
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="inquiry-message" className="block text-sm font-medium text-ink-secondary">Your project</label>
                  <textarea id="inquiry-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="The space, what you want done, and roughly when." rows={5} required className={cn(field, "resize-y py-3 leading-relaxed")}/>
                </div>
                {status.kind === "error" ? <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{status.message}</p> : null}
                <button type="submit" disabled={status.kind === "sending"} className={cn(copperButton, "h-12 w-full text-[15px]")}>
                  {status.kind === "sending" ? <><LoaderCircle className="size-4 animate-spin" aria-hidden/>Sending</> : <>Send inquiry<ArrowRight className={cn("size-4", arrowNudge)} aria-hidden/></>}
                </button>
              </motion.form>)}
          </AnimatePresence>
        </div>
      </div>
    </section>);
}

function Footer() {
    const link = cn("rounded transition-colors duration-300 hover:text-land-ink", ring);
    return (<footer className="border-t border-land-line">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-4 py-12 text-sm text-land-ink-3 sm:px-6 md:flex-row md:items-center md:justify-between">
        <span className="flex items-center gap-2.5">
          <BrandMark className="size-6"/>
          <span><span className="font-medium text-land-ink">ProximaTrax</span> · project tracking for {COMPANY_NAME}</span>
        </span>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <a href="#journey" className={link}>How it runs</a>
          <a href="#inquire" className={link}>Start a project</a>
          <Link href={ROUTES.LOGIN} prefetch={false} className={link}>Log in</Link>
          <span className="tabular md:ml-4">© {new Date().getFullYear()} {COMPANY_NAME}</span>
        </nav>
      </div>
    </footer>);
}

export function LandingPage() {
    const [draft, setDraft] = useState("");
    const nameRef = useRef<HTMLInputElement>(null);
    function start(text: string) {
        if (text)
            setDraft(text);
        document.getElementById("inquire")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        window.setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 650);
    }
    return (<div className="landing min-h-screen bg-land text-land-ink">
      <a href="#journey" className="fixed top-3 left-3 z-[60] -translate-y-16 rounded-full bg-land-ink px-4 py-2 text-sm font-medium text-land transition-transform duration-300 ease-spring focus-visible:translate-y-0 focus-visible:outline-none">Skip to how it runs</a>
      <NavBar onStart={() => start("")}/>
      <main>
        <Hero onStart={start}/>
        <Journey />
        <Inquiry draft={draft} nameRef={nameRef}/>
      </main>
      <Footer />
    </div>);
}
