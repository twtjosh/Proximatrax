import { Skeleton } from "@/components/ui/skeleton";
export default function DashboardLoading() {
    return (<div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48"/>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-32"/>
        <Skeleton className="h-32"/>
        <Skeleton className="h-32"/>
      </div>
      <Skeleton className="h-64"/>
    </div>);
}
