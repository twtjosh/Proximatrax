"use client";
import { Printer } from "lucide-react";
import { focusRing, softAction } from "@/components/dashboard/overview-kit";
import { JourneyLine } from "@/components/projects/pm/journey-line";
import type { ViewerPhoto } from "@/components/projects/shared/photo-viewer";
import { formatDate, isoDateIn, plural } from "@/lib/dashboard";
import type { Station } from "@/lib/pm-project";
import { cn } from "@/lib/utils";
import type { ProjectWithRelations } from "@/services/project-service";

const HIGHLIGHTS = 8;
const long = (iso: string) => formatDate(iso, { month: "long", day: "numeric", year: "numeric" });

/** A closed project as the client keeps it: when, the PM's closing words, every milestone, the best photos, and a printable copy. */
export function HandoverRecord({ project, stations, today, photos, onOpen }: {
    project: ProjectWithRelations;
    stations: Station[];
    today: string;
    photos: ViewerPhoto[];
    onOpen: (index: number) => void;
}) {
    return (<div className="print-record grid gap-5">
      <section aria-labelledby="handover" className="materialize rounded-[24px] material p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-success">Handed over{project.completed_at ? ` · ${long(isoDateIn(project.completed_at))}` : ""}</p>
            <h2 id="handover" className="mt-2 text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-balance text-ink">{project.title}</h2>
            <p className="mt-1 text-sm text-ink-tertiary">{long(project.start_date)} – {long(project.end_date)}{stations.length > 0 ? ` · ${plural(stations.length, "milestone")} delivered` : ""}</p>
          </div>
          <button type="button" data-print-hide onClick={() => window.print()} className={cn(softAction, "h-10 px-4")}>
            <Printer aria-hidden/>
            Print summary
          </button>
        </div>
        {project.completion_statement ? <p className="mt-6 max-w-prose rounded-2xl bg-surface-subtle p-5 text-[15px] leading-relaxed text-ink-secondary">{project.completion_statement}</p> : null}
      </section>
      <JourneyLine projectId={project.id} stations={stations} today={today} plain showWork={false}/>
      {photos.length > 0 ? (<section aria-labelledby="highlights" className="materialize rounded-[20px] material p-5 sm:p-6">
          <h3 id="highlights" className="text-[17px] font-semibold tracking-[-0.016em] text-ink">Photo highlights</h3>
          <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {photos.slice(0, HIGHLIGHTS).map((p, i) => (<li key={p.id}>
                <button type="button" onClick={() => onOpen(i)} className={cn("group press block aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface-sunken", focusRing)}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- approved site photos from storage */}
                  <img src={p.url} alt={p.caption} className="size-full object-cover transition-transform duration-700 ease-spring group-hover:scale-[1.03]"/>
                </button>
              </li>))}
          </ul>
        </section>) : null}
    </div>);
}
