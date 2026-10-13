import { Skeleton } from "@/components/ui/skeleton";
/** Fallback for workspace routes without their own skeleton, so a click paints at once. */
export default function WorkspaceLoading() {
    return (<div className="mx-auto w-full max-w-360 space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-64 max-w-full"/>
      <Skeleton className="h-4 w-96 max-w-full"/>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32 rounded-[20px]"/>)}
      </div>
      <Skeleton className="h-72 rounded-[20px]"/>
    </div>);
}
