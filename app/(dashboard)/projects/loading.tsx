import { Skeleton } from "@/components/ui/skeleton";
export default function ProjectsLoading() {
    return (<div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48"/>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-48"/>))}
      </div>
    </div>);
}
