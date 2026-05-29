import { Skeleton } from "@/components/ui/skeleton";
export default function ProjectDetailLoading() {
    return (<div className="p-6 space-y-4">
      <Skeleton className="h-8 w-64"/>
      <Skeleton className="h-48"/>
      <Skeleton className="h-96"/>
    </div>);
}
