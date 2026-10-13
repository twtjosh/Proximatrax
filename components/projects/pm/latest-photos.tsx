import Link from "next/link";
import { focusRing, OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import type { SitePhoto } from "@/lib/data/pm-project";
import { isoDateIn, relativePast } from "@/lib/dashboard";
import { projectBoardPath } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** The newest photos from site; each opens its task on the board. Hidden when there are none. */
export function LatestPhotos({ projectId, photos, today }: {
    projectId: string;
    photos: SitePhoto[];
    today: string;
}) {
    if (photos.length === 0)
        return null;
    const [first] = photos;
    return (<OverviewCard id="project-photos" title="Latest from site" aside={`${first.by.split(" ")[0]} · ${relativePast(isoDateIn(first.at), today)}`} className="materialize" style={stagger(4)}>
      <div className="grid grid-cols-[1.4fr_1fr] gap-1.5 px-5 pt-1 pb-5 sm:px-6">
        {photos.map((p, i) => (<Link key={p.id} href={projectBoardPath(projectId, { view: "all", q: p.taskTitle })} className={cn("group relative overflow-hidden rounded-xl bg-surface-sunken", i === 0 ? "row-span-2 h-40" : "h-[4.875rem]", focusRing)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- site photos come from Supabase storage */}
            <img src={p.url} alt={`${p.taskTitle}, photo by ${p.by}`} loading="lazy" className="size-full object-cover transition-transform duration-500 ease-spring group-hover:scale-[1.04]"/>
          </Link>))}
      </div>
    </OverviewCard>);
}
