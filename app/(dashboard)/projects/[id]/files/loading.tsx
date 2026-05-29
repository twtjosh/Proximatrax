import { Skeleton } from "@/components/ui/skeleton";
export default function ProjectFilesLoading() {
    return (<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (<Skeleton key={i} className="aspect-[4/3] w-full"/>))}
    </div>);
}
