"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";
import { asMember, DeliveryDots } from "@/components/analytics/marks";
import { Face, focusRing, OverviewCard, OverviewHeader, primaryAction, stagger } from "@/components/dashboard/overview-kit";
import { agePhrase, ageTone, deliveryPhrase, overrunFact } from "@/lib/analytics";
import { analyticsManagerPath, ROUTES } from "@/lib/constants";
import { formatDate, plural } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import type { OwnerAnalytics } from "@/services/analytics-service";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AGE_TONE = { late: "text-danger", warn: "text-warning", quiet: "text-ink-secondary" } as const;
const quiet = "px-5 pt-1 pb-5 text-sm text-ink-tertiary sm:px-6";
const share = (part: number, whole: number) => `${whole > 0 ? (part / whole) * 100 : 0}%`;

/** "Marco’s", "both Marco’s", "all Marco’s" when one manager owns every late project. */
function whose(name: string, n: number) {
    return n === 1 ? `${name}’s` : n === 2 ? `both ${name}’s` : `all ${name}’s`;
}

/**
 * The owner's Overview: one sentence for the business, then who to call
 * (behind schedule), then each manager's load against their record.
 * Pointing at a manager lights up their deliveries.
 */
export function OwnerOverview({ greeting, today, analytics: a, inquiries, unopenedInquiries }: {
    greeting: string;
    /** ISO date (Manila). */
    today: string;
    analytics: OwnerAnalytics;
    /** This year's inquiries. */
    inquiries: { received: number; converted: number; unopened: number };
    /** Every inquiry this viewer has not opened, for the header pill. */
    unopenedInquiries: number;
}) {
    const [lit, setLit] = React.useState<string | null>(null);
    const owners = [...new Set(a.behind.map((b) => b.pm.name.split(" ")[0]))];
    const maxOpen = Math.max(1, ...a.managers.map((m) => m.load.open));
    const tallest = Math.max(2, ...a.months.map((m) => m.deliveries.length));
    const rest = inquiries.received - inquiries.converted - inquiries.unopened;

    return (<div className="mx-auto w-full max-w-360 pb-12">
      <OverviewHeader title={greeting} sub={formatDate(today, { weekday: "long", month: "long", day: "numeric" })} actions={<Link href={ROUTES.INQUIRIES} className={primaryAction}>
            <Inbox aria-hidden/>
            Open inquiries
            {unopenedInquiries > 0 ? <span className="rounded-full bg-white/20 px-2 text-xs leading-5 tabular">{unopenedInquiries}</span> : null}
          </Link>}/>

      <p className="materialize mt-7 max-w-[30em] text-[20px] leading-[1.35] font-[450] tracking-[-0.022em] text-pretty text-ink-secondary sm:text-[26px] [&_b]:font-semibold [&_b]:text-ink" style={stagger(1)}>
        <b>{plural(a.activeCount, "project")}</b> {a.activeCount === 1 ? "is" : "are"} running under <b>{plural(a.managers.length, "project manager")}</b>.{" "}
        {a.behind.length > 0
            ? (<><a href="#behind-heading" className={cn("font-semibold text-danger underline decoration-danger/35 decoration-[1.5px] underline-offset-4 hover:decoration-danger", focusRing)}>{a.behind.length} {a.behind.length === 1 ? "is" : "are"} behind schedule</a>{owners.length === 1 ? `, ${whose(owners[0], a.behind.length)}` : ""}.</>)
            : "Every project is on schedule."}{" "}
        This year AEG has delivered <b>{plural(a.year.delivered, "project")}</b>{a.year.delivered > 0 ? <>, <b>{a.year.onTime} of them on time</b></> : null}.
      </p>
      <p className="materialize mt-2 text-sm text-ink-tertiary" style={stagger(2)}>
        {a.people.total} {a.people.total === 1 ? "person has an account" : "people have accounts"}: {plural(a.people.pm, "project manager")}, {a.people.crew} crew, {plural(a.people.client, "client")}.
      </p>

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <OverviewCard id="behind-heading" title="Behind schedule" count={a.behind.length} aside={a.behind.length > 1 ? "Most late first" : undefined} className="materialize" style={stagger(3)}>
          {a.behind.length === 0 ? <p className={quiet}>Every project is on schedule.</p> : (<ul className="pb-2">
              {a.behind.map((b) => (<li key={b.project.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-t border-line px-5 py-3.5 first:border-t-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-6">
                  <span className="grid size-14 place-content-center rounded-[14px] bg-danger-soft text-center leading-none text-danger">
                    <b className="text-[22px] font-semibold tracking-[-0.02em] tabular">{b.days}</b>
                    <span className="mt-1 text-[10.5px] font-medium">{b.days === 1 ? "day late" : "days late"}</span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{b.project.title}</p>
                    <p className="mt-0.5 text-[13px] text-ink-secondary">{overrunFact(b, b.project)}</p>
                  </div>
                  <span className="col-start-2 flex items-center gap-2 text-[13px] whitespace-nowrap text-ink-secondary sm:col-start-auto">
                    <Face person={asMember(b.pm)} size={24}/>
                    {b.pm.name}
                  </span>
                </li>))}
            </ul>)}
        </OverviewCard>

        <OverviewCard id="inquiries-heading" title="Inquiries this year" aside={<Link href={ROUTES.INQUIRIES} className={cn("inline-flex items-center gap-0.5 text-[13px] font-medium text-brand hover:text-brand-hover", focusRing)}>Inbox<ChevronRight className="size-3.5" aria-hidden/></Link>} className="materialize" style={stagger(4)}>
          <div className="px-5 pb-5 sm:px-6">
            <p className="text-[34px] leading-none font-semibold tracking-[-0.03em] text-ink tabular">
              {inquiries.received}
              <span className="ml-1.5 text-sm font-medium tracking-normal text-ink-tertiary">received</span>
            </p>
            {inquiries.received > 0 ? (<span className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                <span className="bg-copper" style={{ width: share(inquiries.converted, inquiries.received) }}/>
                <span className="bg-stage-review" style={{ width: share(inquiries.unopened, inquiries.received) }}/>
              </span>) : null}
            <dl className="mt-3 space-y-2 text-[13px] text-ink-secondary">
              {([["Became projects", inquiries.converted, "bg-copper"], ["Not yet opened", inquiries.unopened, "bg-stage-review"], ["Answered, no project yet", rest, "bg-surface-sunken"]] as const).map(([label, value, swatch]) => (<div key={label} className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-[3px]", swatch)} aria-hidden/>
                  <dt>{label}</dt>
                  <dd className="ml-auto font-semibold text-ink tabular">{value}</dd>
                </div>))}
            </dl>
          </div>
        </OverviewCard>
      </div>

      <OverviewCard id="managers-heading" title="Project managers" count={a.managers.length} aside="Open work now · delivered this year" className="materialize mt-5" style={stagger(5)}>
        {a.managers.length === 0 ? <p className={quiet}>No project managers yet. Add one from People.</p> : a.managers.map((m) => {
            const rest = m.load.open - m.load.late - m.load.review;
            return (<Link key={m.id} href={analyticsManagerPath(m.id)} onPointerEnter={() => setLit(m.id)} onPointerLeave={() => setLit(null)} onFocus={() => setLit(m.id)} onBlur={() => setLit(null)} className={cn("grid grid-cols-[minmax(0,1fr)_18px] items-center gap-x-6 gap-y-3 border-t border-line px-5 py-4 transition-colors hover:bg-surface-subtle sm:px-6 md:grid-cols-[220px_minmax(0,1fr)_240px_18px]", focusRing)}>
              <span className="flex min-w-0 items-center gap-3">
                <Face person={asMember(m)} size={36}/>
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-semibold text-ink">{m.name}</span>
                  <span className="block text-[12.5px] text-ink-tertiary">
                    {plural(m.active, "active project")}
                    {m.behind > 0 ? <> · <span className="text-danger">{m.behind} behind</span></> : null}
                  </span>
                </span>
              </span>
              <ChevronRight className="size-[18px] text-ink-tertiary md:order-last" aria-hidden/>
              <span className="col-start-1 block min-w-0 md:col-start-auto">
                <span className="block text-[13px] text-ink"><b className="font-semibold tabular">{m.load.open}</b> open tasks</span>
                {m.load.open > 0 ? (<span className="my-1.5 flex h-3 gap-0.5 overflow-hidden rounded-[5px]" style={{ width: share(m.load.open, maxOpen) }} aria-hidden>
                    {m.load.late > 0 ? <span className="bg-stage-late" style={{ flex: m.load.late }}/> : null}
                    {m.load.review > 0 ? <span className="bg-stage-review" style={{ flex: m.load.review }}/> : null}
                    {rest > 0 ? <span className="bg-stage-todo" style={{ flex: rest }}/> : null}
                  </span>) : null}
                <span className="block text-[12.5px] text-ink-secondary">
                  {m.load.late > 0 ? <span className="text-danger">{m.load.late} late</span> : "None late"}
                  {" · "}
                  {m.load.review > 0
                    ? <span className={AGE_TONE[ageTone(m.oldestReviewDays ?? 0)]}>{m.load.review} waiting for review{m.oldestReviewDays !== null ? `, oldest ${agePhrase(m.oldestReviewDays)}` : ""}</span>
                    : "nothing waiting for review"}
                </span>
              </span>
              <span className="col-start-1 block md:col-start-auto">
                {m.record.delivered > 0 ? (<>
                    <DeliveryDots dots={m.dots}/>
                    <span className="mt-1.5 block text-[12.5px] text-ink-secondary">
                      <b className="font-semibold text-ink tabular">{m.record.onTime} of {m.record.delivered}</b> on time
                      {m.record.avgLate !== null ? <> · <span className="text-danger">late ones ran {plural(m.record.avgLate, "day")} over</span></> : null}
                    </span>
                  </>) : <span className="text-[12.5px] text-ink-tertiary">Nothing delivered this year</span>}
              </span>
            </Link>);
        })}
      </OverviewCard>

      <OverviewCard id="deliveries-heading" title="Deliveries" aside={<span className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-stage-done" aria-hidden/>On time</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-stage-late" aria-hidden/>Late</span>
            <span className="hidden md:inline">One block per project · point at a manager to see theirs</span>
          </span>} className="materialize mt-5" style={stagger(6)}>
        <div className="grid grid-cols-12 items-end gap-1.5 px-4 pt-3 sm:gap-2.5 sm:px-6" style={{ height: tallest * 30 + 12 }}>
          {a.months.map((mo) => (<div key={mo.key} role="img" aria-label={`${MONTHS[mo.month]} ${mo.year}: ${plural(mo.deliveries.length, "project")} delivered`} className="flex h-full flex-col-reverse items-center gap-1">
              {mo.deliveries.map((d, j) => (<span key={j} title={`${d.title} · ${d.pmName} · ${deliveryPhrase(d.late)}`} className={cn("block h-[26px] w-full max-w-[34px] rounded-[6px] transition-[opacity,scale] duration-300 ease-[var(--ease-spring)]", d.late > 0 ? "bg-stage-late" : "bg-stage-done", lit !== null && lit !== d.pmId && "opacity-20", lit === d.pmId && "scale-105")}/>))}
            </div>))}
        </div>
        <div className="grid grid-cols-12 gap-1.5 px-4 pt-1.5 pb-5 text-center text-[11px] text-ink-tertiary sm:gap-2.5 sm:px-6" aria-hidden>
          {a.months.map((mo) => <span key={mo.key} className={mo.month === 0 ? "font-medium text-ink-secondary" : undefined}>{mo.month === 0 ? mo.year : MONTHS[mo.month]}</span>)}
        </div>
      </OverviewCard>
    </div>);
}
