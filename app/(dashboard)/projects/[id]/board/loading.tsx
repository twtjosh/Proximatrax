import { Skeleton } from "@/components/ui/skeleton";
export default function ProjectBoardLoading() {
    return (<div className="grid grid-cols-1 gap-4 md:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (<div key={i} className="space-y-3 border border-slate-200 bg-white p-3">
          <Skeleton className="h-4 w-24"/>
          <Skeleton className="h-20 w-full"/>
          <Skeleton className="h-20 w-full"/>
        </div>))}
    </div>);
}
