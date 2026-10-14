"use client";
import Link from "next/link";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { focusRing, ProgressRing, softAction, stagger, trackSpotlight } from "@/components/dashboard/overview-kit";
import { projectBoardPath, projectReviewPath, projectTimelinePath } from "@/lib/constants";
import { agoPhrase, daysBetween, formatDate, isoDateIn, plural } from "@/lib/dashboard";
import { HEALTH, type StatusUpdate } from "@/lib/project-log";
import type { Forecast } from "@/lib/project-insights";
import { cn } from "@/lib/utils";
import { HEALTH_STYLE, postUpdate } from "../status-update-dialog";

const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });
const tile = cn("spotlight material-interactive press press-soft materialize group relative flex min-h-32 flex-col justify-between gap-3 rounded-[20px] material p-4", focusRing);

/**
 * The top of the PM's Overview: the PM's own word on the project, then four
 * numbers that each open the work behind them.
 */
export function StatusStrip({ projectId, update, accepted, total, end, forecast, late, inReview, today, closed, by }: {
    projectId: string;
    update: StatusUpdate | null;
    accepted: number;
    total: number;
    end: string;
    forecast: Forecast;
    late: number;
    inReview: number;
    today: string;
    closed: boolean;
    by: string | null;
}) {
    const left = daysBetween(today, end);
    const share = total ? accepted / total : 0;
    return (<div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)]">
      <section aria-label="Status update" className="materialize flex min-h-32 flex-col gap-3 rounded-[20px] material p-5" style={stagger(0)}>
        {update ? (<>
            <div className="flex items-center gap-2">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", HEALTH_STYLE[update.health].chip)}><span className={cn("size-1.5 rounded-full", HEALTH_STYLE[update.health].dot)} aria-hidden/>{HEALTH[update.health].label}</span>
              <span className="truncate text-xs text-ink-tertiary">{by ?? "You"} · {agoPhrase(isoDateIn(update.at), today)}</span>
              {!closed ? <button type="button" onClick={postUpdate} className={cn(softAction, "ml-auto shrink-0")}><Megaphone aria-hidden/>Update</button> : null}
            </div>
            <p className="line-clamp-3 text-[15px] leading-relaxed text-pretty text-ink">{update.note}</p>
            {daysBetween(isoDateIn(update.at), today) > 7 && !closed ? <p className="text-xs font-medium text-warning">Over a week old. The client is reading this.</p> : null}
          </>) : (<>
            <p className="text-[15px] font-semibold">How does the project stand?</p>
            <p className="text-sm text-ink-secondary">Post a status update: On track, At risk or Off track, with a few lines. It heads this page and the client sees it.</p>
            {!closed ? <button type="button" onClick={postUpdate} className={cn(softAction, "mt-auto w-fit")}><Megaphone aria-hidden/>Post update</button> : null}
          </>)}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href={projectBoardPath(projectId, { view: "list" })} onPointerMove={trackSpotlight} className={tile} style={stagger(1)}>
          <Label text="Progress"/>
          <div className="flex items-end justify-between gap-2">
            <p><span className="text-[1.65rem] leading-none font-semibold tracking-[-0.03em] tabular">{Math.round(share * 100)}%</span><span className="mt-1 block text-xs text-ink-tertiary tabular">{accepted} of {plural(total, "task")} accepted</span></p>
            <ProgressRing value={share} size={40} stroke={4.5}/>
          </div>
        </Link>
        <Link href={projectTimelinePath(projectId)} onPointerMove={trackSpotlight} className={tile} style={stagger(2)}>
          <Label text="Handover"/>
          <p>
            <span className={cn("text-[1.65rem] leading-none font-semibold tracking-[-0.03em] tabular", left < 0 && !closed && "text-danger")}>{closed ? "Done" : left >= 0 ? `${left}d` : `${-left}d over`}</span>
            <span className="mt-1 block text-xs text-ink-tertiary">{closed ? `Closed · planned ${short(end)}` : forecast ? (forecast.slip > 0 ? <>At this pace <b className="font-semibold text-warning">{short(forecast.date)}</b>, {forecast.slip}d late</> : <>At this pace {short(forecast.date)}, <b className="font-semibold text-success">on time</b></>) : `Due ${short(end)}`}</span>
          </p>
        </Link>
        <Link href={projectBoardPath(projectId, { view: "list", late: "1" })} onPointerMove={trackSpotlight} className={tile} style={stagger(3)}>
          <Label text="Late"/>
          <p>
            <span className={cn("text-[1.65rem] leading-none font-semibold tracking-[-0.03em] tabular", late ? "text-danger" : "text-ink")}>{late}</span>
            <span className="mt-1 block text-xs text-ink-tertiary">{late ? "past their due date" : "Nothing overdue"}</span>
          </p>
        </Link>
        <Link href={projectReviewPath(projectId)} onPointerMove={trackSpotlight} className={tile} style={stagger(4)}>
          <Label text="In review"/>
          <p>
            <span className={cn("text-[1.65rem] leading-none font-semibold tracking-[-0.03em] tabular", inReview ? "text-warning" : "text-ink")}>{inReview}</span>
            <span className="mt-1 block text-xs text-ink-tertiary">{inReview ? "waiting for your sign-off" : "Nothing to review"}</span>
          </p>
        </Link>
      </div>
    </div>);
}

function Label({ text }: {
    text: string;
}) {
    return (<span className="flex items-center justify-between text-xs font-medium text-ink-secondary">
      {text}
      <ArrowUpRight className="size-3.5 text-ink-tertiary opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden/>
    </span>);
}
