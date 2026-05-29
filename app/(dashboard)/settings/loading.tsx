import { Skeleton } from "@/components/ui/skeleton";
export default function SettingsLoading() {
    return (<div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48"/>
      <Skeleton className="h-64"/>
    </div>);
}
