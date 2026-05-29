import { Skeleton } from "@/components/ui/skeleton";
export default function ProjectChatLoading() {
    return (<div className="space-y-3 border border-slate-200 bg-white p-5">
      {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className={i % 2 === 0 ? "h-12 w-2/3" : "ml-auto h-12 w-1/2"}/>))}
    </div>);
}
