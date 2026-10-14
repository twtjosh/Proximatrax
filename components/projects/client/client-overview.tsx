"use client";
import * as React from "react";
import { JourneyLine } from "@/components/projects/pm/journey-line";
import { PhotoViewer } from "@/components/projects/shared/photo-viewer";
import { clientStage, newSince, nextMilestoneSentence, sinceLabel } from "@/lib/client-project";
import type { ClientProjectData } from "@/lib/data/client-project";
import { formatDate, isoDateIn } from "@/lib/dashboard";
import { journeyStations } from "@/lib/pm-project";
import { cn } from "@/lib/utils";
import { HandoverRecord } from "./handover-record";
import { LatestUpdate } from "./latest-update";
import { PmCard } from "./pm-card";
import { SinceLastVisit } from "./since-last-visit";
import { toViewerPhotos, useVisitBaseline } from "./visit-baseline";

const short = (iso: string) => formatDate(iso, { month: "long", day: "numeric", year: "numeric" });

/**
 * The client's project Overview: their space taking shape. What it shows
 * depends on the project: being planned, under way, every milestone
 * delivered, or handed over.
 */
export function ClientOverview({ data }: {
    data: ClientProjectData;
}) {
    const { project, milestones, updates, photos, today } = data;
    const baseline = useVisitBaseline(project.id);
    const [index, setIndex] = React.useState<number | null>(null);
    const stage = clientStage(project.status, milestones);
    const stations = journeyStations(milestones, [], today);
    const sentence = nextMilestoneSentence(milestones, today);
    const fresh = newSince(updates, baseline);
    const viewer = toViewerPhotos(photos, milestones);
    const newest = updates[0];
    const newestText = newest ? { title: newest.title, line: [`Accepted ${formatDate(isoDateIn(newest.at), { month: "short", day: "numeric" })}`, milestones.find((m) => m.id === newest.milestone_id)?.title].filter(Boolean).join(" · ") } : undefined;
    const viewerNode = <PhotoViewer photos={viewer} index={index} onIndex={setIndex} onClose={() => setIndex(null)}/>;
    const failed = data.loadFailed ? <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">Some updates couldn&apos;t be loaded. Reload to try again.</p> : null;

    if (stage === "closed") {
        return (<>
          {failed}
          <HandoverRecord project={project} stations={stations} today={today} photos={viewer} onOpen={setIndex}/>
          {viewerNode}
        </>);
    }

    const journey = stations.length > 0 ? (<div className="grid gap-3">
        <JourneyLine projectId={project.id} stations={stations} today={today} plain showWork={false}/>
        {sentence ? <p className={cn("px-2 text-[15px] font-medium", sentence.late ? "text-danger" : "text-ink")}>{sentence.text}</p> : null}
      </div>) : (<p className="materialize rounded-[20px] material px-6 py-7 text-sm text-ink-secondary">Your milestones will appear here once your project manager sets them.</p>);

    if (stage === "planning") {
        return (<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid min-w-0 gap-5">
            {failed}
            <section aria-labelledby="planning" className="materialize rounded-[24px] material p-6 sm:p-8">
              <h2 id="planning" className="text-[1.5rem] leading-tight font-semibold tracking-[-0.025em] text-ink">Your project is being planned</h2>
              <p className="mt-2 text-sm text-ink-secondary">Planned for {short(project.start_date)} to {short(project.end_date)}.</p>
              <ol className="mt-6 grid gap-3 text-sm text-ink-secondary">
                {["Your project manager sets the milestones and their dates.", "Work starts on site.", "When your project manager accepts finished work, it appears here with its photos."].map((step, i) => (<li key={step} className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs font-semibold text-ink tabular" aria-hidden>{i + 1}</span>
                    {step}
                  </li>))}
              </ol>
            </section>
            {stations.length > 0 ? journey : null}
          </div>
          <PmCard projectId={project.id} pm={project.pm}/>
        </div>);
    }

    return (<div className="grid gap-5">
      {failed}
      {stage === "delivered" ? <p role="status" className="materialize rounded-2xl bg-success-soft px-4 py-3 text-sm font-medium text-success">Every milestone is delivered. Your project manager is preparing the handover.</p> : null}
      <LatestUpdate photo={viewer[0]} text={newestText} onOpen={() => setIndex(0)}/>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">{journey}</div>
        <div className="grid gap-5">
          {baseline ? <SinceLastVisit projectId={project.id} count={fresh.length} label={sinceLabel(baseline, today)}/> : null}
          <PmCard projectId={project.id} pm={project.pm}/>
        </div>
      </div>
      {viewerNode}
    </div>);
}
