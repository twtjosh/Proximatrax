"use client";
import * as React from "react";
import { JourneyLine } from "@/components/projects/pm/journey-line";
import { PhotoViewer, type ViewerPhoto } from "@/components/projects/shared/photo-viewer";
import { clientStage, focusMilestone, newSince, nextMilestoneSentence, sinceLabel } from "@/lib/client-project";
import type { ClientProjectData } from "@/lib/data/client-project";
import { formatDate } from "@/lib/dashboard";
import { journeyStations } from "@/lib/pm-project";
import { cn } from "@/lib/utils";
import { HandoverRecord } from "./handover-record";
import { LatestPhoto } from "./latest-photo";
import { MilestoneFocus } from "./milestone-focus";
import { RecentUpdates } from "./recent-updates";
import { SinceLastVisit } from "./since-last-visit";
import { toViewerPhotos, useVisitBaseline } from "./visit-baseline";

const long = (iso: string) => formatDate(iso, { month: "long", day: "numeric" });

/**
 * The client's project Overview. The headline answers "what's next, and is it
 * on time"; the journey and the milestone under it show what happened where;
 * the side keeps what's new. Messaging lives in the header, once.
 */
export function ClientOverview({ data }: {
    data: ClientProjectData;
}) {
    const { project, milestones, updates, photos, today } = data;
    const baseline = useVisitBaseline(project.id);
    const stations = journeyStations(milestones, [], today);
    const [picked, setPicked] = React.useState<string | null>(null);
    const selected = picked && stations.some((s) => s.id === picked) ? picked : focusMilestone(milestones);
    const [viewer, setViewer] = React.useState<{ list: ViewerPhoto[]; index: number } | null>(null);
    const stage = clientStage(project.status, milestones, updates.length);
    const sentence = nextMilestoneSentence(milestones, today);
    const fresh = new Set(newSince(updates, baseline).map((u) => u.id));
    const all = toViewerPhotos(photos, milestones);
    const tagged = all.map((p, k) => ({ ...p, milestone_id: photos[k].milestone_id }));
    const nextId = stations.find((s) => s.state !== "delivered")?.id ?? null;
    const viewerNode = <PhotoViewer photos={viewer?.list ?? []} index={viewer?.index ?? null} onIndex={(index) => setViewer((v) => (v ? { ...v, index } : v))} onClose={() => setViewer(null)}/>;
    const failed = data.loadFailed ? <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">Some updates couldn&apos;t be loaded. Reload to try again.</p> : null;

    if (stage === "closed") {
        return (<div className="grid gap-5">
          {failed}
          <HandoverRecord project={project} stations={stations} today={today} photos={all} onOpen={(index) => setViewer({ list: all, index })}/>
          {viewerNode}
        </div>);
    }

    const headline = stage === "planning" ? { text: "Your project is being planned", tone: "text-ink" }
        : stage === "delivered" ? { text: "Every milestone is delivered", tone: "text-success" }
            : sentence ? { text: sentence.text, tone: sentence.late ? "text-danger" : "text-ink" }
                : { text: "Your project is under way", tone: "text-ink" };
    const sub = stage === "planning" ? `Planned for ${long(project.start_date)} to ${long(project.end_date)}. ${project.pm?.full_name ?? "Your project manager"} is setting the milestones; finished work appears here as it is accepted.`
        : stage === "delivered" ? "Your project manager is preparing the handover."
            : project.status === "on_hold" ? "Your project manager has paused work for now. Message them if you have questions."
                : null;

    return (<div className="grid gap-6">
      {failed}
      <header className="materialize">
        <h2 className={cn("text-[clamp(1.4rem,2.6vw,1.9rem)] leading-tight font-semibold tracking-[-0.03em] text-balance", headline.tone)}>{headline.text}</h2>
        {sub ? <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">{sub}</p> : null}
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-5">
          {stations.length > 0 && selected ? (<>
              <JourneyLine projectId={project.id} stations={stations} today={today} plain showWork={false} selected={selected} onSelect={setPicked}/>
              <MilestoneFocus stations={stations} selected={selected} onSelect={setPicked} nextId={nextId} updates={updates} photos={tagged} today={today} onOpenPhoto={(list, index) => setViewer({ list, index })}/>
            </>) : <p className="materialize rounded-[20px] material px-6 py-7 text-sm text-ink-secondary">Your milestones will appear here once your project manager sets them.</p>}
        </div>
        <aside aria-label="What's new" className="grid gap-5 lg:sticky lg:top-[calc(var(--frame-h,0px)+1.5rem)]">
          {baseline ? <SinceLastVisit projectId={project.id} count={fresh.size} label={sinceLabel(baseline, today)}/> : null}
          {all[0] ? <LatestPhoto photo={all[0]} onOpen={() => setViewer({ list: all, index: 0 })}/> : null}
          <RecentUpdates projectId={project.id} updates={updates} milestones={milestones} fresh={fresh}/>
        </aside>
      </div>
      {viewerNode}
    </div>);
}
