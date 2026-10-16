"use client";
import * as React from "react";
import { Loader2, Printer, X } from "lucide-react";
import { focusRing, primaryAction } from "@/components/dashboard/overview-kit";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { PmProjectData } from "@/lib/data/pm-project";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_TERMS } from "@/lib/vocabulary";
import { listProjectActivityPage, type ActivityWithActor } from "@/services/activity-service";
import { listTaskAttachmentsForProject, publicTaskAttachmentUrl } from "@/services/task-attachment-service";
import { ProjectReport } from "./project-report";

type Extra = { activity: ActivityWithActor[]; photos: Record<string, string[]> };

/**
 * The project report as a print preview over whatever tab is open: the page
 * on a desk, a toolbar to print or close. Closing lands back on the same tab.
 * Activity and photos load each time it opens; Print waits for them so the
 * paper copy is never missing a section.
 */
export function ReportDialog({ open, onOpenChange, data }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    data: PmProjectData;
}) {
    const { project } = data;
    const [extra, setExtra] = React.useState<Extra | null>(null);

    React.useEffect(() => {
        if (!open)
            return;
        let live = true;
        setExtra(null);
        Promise.all([
            listProjectActivityPage(project.id, { limit: 10 }).catch(() => []),
            listTaskAttachmentsForProject(project.id).catch(() => []),
        ]).then(([activity, attachments]) => {
            const photos: Record<string, string[]> = {};
            for (const a of attachments) {
                if (a.media_kind === "photo")
                    (photos[a.task_id] ??= []).push(publicTaskAttachmentUrl(a.storage_path));
            }
            if (live)
                setExtra({ activity, photos });
        });
        return () => { live = false; };
    }, [open, project.id]);

    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="top-[3vh] flex max-h-[94vh] translate-y-0 flex-col gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-[58rem] print:static print:max-h-none print:max-w-none print:translate-none print:animate-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        <div data-print-hide className="flex items-center gap-3 border-b border-line bg-surface px-5 py-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate">Project report</DialogTitle>
            <DialogDescription className="truncate text-[13px]">One page to print or save as PDF, from the project as it is now.</DialogDescription>
          </div>
          <button type="button" disabled={!extra} onClick={() => window.print()} className={cn(primaryAction, "h-9 px-4 disabled:pointer-events-none disabled:opacity-60")}>
            {extra ? <Printer aria-hidden/> : <Loader2 className="animate-spin" aria-hidden/>}
            <span className="max-sm:hidden">Print or save PDF</span>
            <span className="sm:hidden">Print</span>
          </button>
          <DialogClose aria-label="Close report" className={cn("press grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-secondary hover:bg-surface-sunken hover:text-ink", focusRing)}>
            <X className="size-4" aria-hidden/>
          </DialogClose>
        </div>
        <div className="overflow-y-auto overscroll-contain bg-surface-sunken p-3 sm:p-8 print:overflow-visible print:bg-transparent print:p-0">
          <ProjectReport title={project.title} client={project.client?.full_name ?? "the client"} pm={data.team.find((m) => m.id === project.pm_id)?.name ?? "—"} start={project.start_date} end={project.end_date} status={PROJECT_STATUS_TERMS[project.status].label} milestones={data.milestones} tasks={data.tasks} team={data.team} update={data.update} activity={extra?.activity ?? []} photos={extra?.photos ?? {}} today={data.today}/>
        </div>
      </DialogContent>
    </Dialog>);
}
