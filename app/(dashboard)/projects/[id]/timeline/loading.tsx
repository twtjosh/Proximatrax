import { Skeleton } from "@/components/ui/skeleton";
export default function ProjectTimelineLoading() {
    return (<div className="space-y-4 border border-slate-200 bg-white p-5">
      <Skeleton className="h-5 w-48"/>
      <Skeleton className="h-[420px] w-full"/>
    </div>);
}
