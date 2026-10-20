import { Skeleton } from "@/components/ui/skeleton";
export default function SettingsLoading() {
    return (<div className="mx-auto w-full max-w-360" aria-busy="true">
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-3">
          <Skeleton className="h-10 w-40 rounded-lg"/>
          <Skeleton className="h-4 w-72"/>
        </div>
        <Skeleton className="h-10 w-32 rounded-full"/>
      </div>
      <div className="mt-7 rounded-[20px] material p-4">
        <Skeleton className="h-8 w-80 max-w-full rounded-full"/>
        <div className="mt-5 space-y-4 px-2">
          {Array.from({ length: 6 }, (_, i) => (<div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9.5 rounded-full"/>
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-40"/>
                <Skeleton className="h-3 w-24"/>
              </div>
            </div>))}
        </div>
      </div>
    </div>);
}
