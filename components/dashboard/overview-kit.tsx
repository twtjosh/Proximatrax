import type { TeamMember } from "@/lib/data/project-context";
import { cn } from "@/lib/utils";

/** Staggers a `.materialize` entrance; siblings arrive 70ms apart. */
export const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;

export const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

/** The Overview's one primary action: a copper pill with a warm lift. */
export const primaryAction = cn("press group/action inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(120_53_15/0.25),0_8px_20px_-8px_rgb(180_83_9/0.55)] hover:bg-brand-hover [&_svg]:size-4", focusRing);

/** Feeds the pointer position to a `.spotlight` card so its light follows the cursor. */
export function trackSpotlight(e: React.PointerEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

/** A quiet secondary action for inside cards. */
export const softAction = cn("press inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3.5 text-[13px] font-medium text-ink hover:bg-line [&_svg]:size-3.5", focusRing);

/**
 * The top of every role's Overview: who it greets, one line of context set
 * quietly underneath, and at most one action.
 */
export function OverviewHeader({ title, sub, actions }: {
    title: React.ReactNode;
    sub?: React.ReactNode;
    actions?: React.ReactNode;
}) {
    return (<header className="materialize flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
      <div className="min-w-0">
        <h1 className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance text-ink sm:text-[2.5rem]">{title}</h1>
        {sub ? <p className="mt-2 text-[15px] text-ink-tertiary [&_b]:font-medium [&_b]:text-ink">{sub}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>);
}

/** A white card with a title row. `aside` sits at the right of the title. */
export function OverviewCard({ id, title, count, aside, children, className, style }: {
    id: string;
    title: string;
    count?: number;
    aside?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}) {
    return (<section aria-labelledby={id} className={cn("min-w-0 rounded-[20px] material", className)} style={style}>
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2 sm:px-6">
        <h2 id={id} className="text-[17px] font-semibold tracking-[-0.016em] text-ink">
          {title}
          {count ? <span className="ml-1.5 font-medium text-ink-tertiary tabular">{count}</span> : null}
        </h2>
        {aside ? <div className="text-xs text-ink-tertiary">{aside}</div> : null}
      </div>
      {children}
    </section>);
}

/**
 * Share of work accepted as a copper ring (green once everything is accepted).
 * It draws itself once on first paint. Decorative: callers state the value.
 */
export function ProgressRing({ value, done = value >= 1, track = "var(--surface-sunken)", glow = false, size = 76, stroke = 7, className, children }: {
    /** 0..1 */
    value: number;
    /** Green means finished; pass false to keep a full ring copper while work is still late. */
    done?: boolean;
    /** Colour of the unfilled ring. */
    track?: string;
    /** A soft copper bloom around the ring, for a box that is lifted. */
    glow?: boolean;
    size?: number;
    stroke?: number;
    className?: string;
    children?: React.ReactNode;
}) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const complete = done;
    return (<span className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className={cn("absolute inset-0 -rotate-90 transition-[filter] duration-500", glow && "drop-shadow-[0_0_6px_rgb(217_119_6/0.55)]")} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} style={{ transition: "stroke 500ms var(--ease-spring)" }}/>
        {value > 0 ? <circle className="ring-draw" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={complete ? "var(--stage-done)" : "var(--copper)"} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${Math.max(value * c, 0.001)} ${c}`}/> : null}
      </svg>
      <span className="relative">{children}</span>
    </span>);
}

function initials(name: string) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

/** A person's face, or their initials on a warm ground when there is no photo. */
export function Face({ person, size = 28, className }: {
    person: TeamMember;
    size?: number;
    className?: string;
}) {
    return (<span className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft font-semibold text-brand ring-2 ring-surface", className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden>
      {initials(person.name).slice(0, size < 28 ? 1 : 2)}
      {/* eslint-disable-next-line @next/next/no-img-element -- avatars come from Supabase storage at small sizes */}
      {person.avatarUrl ? <img src={person.avatarUrl} alt="" className="absolute inset-0 size-full object-cover"/> : null}
    </span>);
}

/** Overlapping faces, at most `max`, then "+n". Names are stated by the caller. */
export function FaceStack({ people, max = 3, size = 26 }: {
    people: TeamMember[];
    max?: number;
    size?: number;
}) {
    const shown = people.slice(0, max);
    const rest = people.length - shown.length;
    return (<span className="flex items-center -space-x-1" aria-hidden>
      {shown.map((p) => <Face key={p.id} person={p} size={size}/>)}
      {rest > 0 ? <span className="relative inline-grid place-items-center rounded-full bg-surface-sunken text-[11px] font-semibold text-ink-secondary ring-2 ring-surface tabular" style={{ width: size, height: size }}>+{rest}</span> : null}
    </span>);
}
