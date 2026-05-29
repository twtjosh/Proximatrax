"use client";
import { Film, ImageIcon } from "lucide-react";
import { publicTaskAttachmentUrl, type ApprovedAttachment, } from "@/services/task-attachment-service";
import { formatDisplayDate } from "@/lib/milestone-utils";
import { cn } from "@/lib/utils";
export function ApprovedSiteGallery({ items, className, emptyMessage = "Approved site photos will appear here after your PM signs off deliverables.", }: {
    items: ApprovedAttachment[];
    className?: string;
    emptyMessage?: string;
}) {
    const visual = items.filter((item) => item.media_kind === "photo" || item.media_kind === "video");
    if (visual.length === 0) {
        return (<div className={cn("rounded-xl border border-dashed border-stone-200 bg-stone-50/60 px-6 py-12 text-center", className)}>
        <ImageIcon className="mx-auto h-9 w-9 text-stone-300"/>
        <p className="mt-3 text-sm text-stone-600">{emptyMessage}</p>
      </div>);
    }
    return (<div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {visual.map((item) => {
            const url = publicTaskAttachmentUrl(item.storage_path);
            const label = item.task?.title ?? item.file_name;
            const when = item.approved_for_client_at
                ? formatDisplayDate(item.approved_for_client_at.slice(0, 10))
                : "";
            return (<figure key={item.id} className="group overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-sm">
            <a href={url} target="_blank" rel="noopener noreferrer" className="relative block aspect-4/3 overflow-hidden bg-stone-100">
              {item.media_kind === "video" ? (<>
                  <video src={url} preload="metadata" className="h-full w-full object-cover"/>
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Film className="h-8 w-8 text-white/90"/>
                  </span>
                </>) : (<img src={url} alt={label} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"/>)}
            </a>
            <figcaption className="space-y-0.5 px-3 py-2">
              <p className="truncate text-sm font-medium text-stone-900">{label}</p>
              {when ? (<p className="text-[11px] text-stone-500">Approved {when}</p>) : null}
            </figcaption>
          </figure>);
        })}
    </div>);
}
