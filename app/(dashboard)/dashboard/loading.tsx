import { Skeleton } from "@/components/ui/skeleton";

const card = "rounded-[20px] material";

/** Mirrors the Overview (header, a row of tiles, two cards) so nothing jumps when data lands. */
export default function DashboardLoading() {
    return (<div className="mx-auto w-full max-w-360" aria-busy="true" aria-label="Loading overview">
      <Skeleton className="h-10 w-72 max-w-full"/>
      <Skeleton className="mt-3 h-4 w-96 max-w-full"/>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (<div key={i} className={`${card} p-5`}>
            <div className="flex items-center gap-4">
              <Skeleton className="size-[76px] shrink-0 rounded-full"/>
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4"/>
                <Skeleton className="h-3 w-1/2"/>
              </div>
            </div>
            <Skeleton className="mt-6 h-4 w-1/3"/>
          </div>))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {Array.from({ length: 2 }, (_, i) => (<div key={i} className={`${card} space-y-4 p-6`}>
            <Skeleton className="h-5 w-28"/>
            {Array.from({ length: 4 }, (_, j) => (<div key={j} className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-[11px]"/>
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3"/>
                  <Skeleton className="h-3 w-1/3"/>
                </div>
              </div>))}
          </div>))}
      </div>
    </div>);
}
