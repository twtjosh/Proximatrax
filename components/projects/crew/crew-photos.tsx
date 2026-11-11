"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { focusRing, OverviewCard } from "@/components/dashboard/overview-kit";
import { InAppBrowserNotice } from "@/components/middleman/in-app-notice";
import { SiteCamera } from "@/components/middleman/site-camera";
import { useTouch } from "@/components/middleman/task-workbench";
import { PhotoViewer, type ViewerPhoto } from "@/components/projects/shared/photo-viewer";
import { normalizeBoardStage } from "@/lib/board-workflow";
import { photoStatus, type PhotoStatus } from "@/lib/crew-project";
import type { CrewProjectData } from "@/lib/data/crew-project";
import { locate, prepareSiteMedia, type Fix } from "@/lib/photo-stamp";
import { cn } from "@/lib/utils";
import { TASK_STAGE_TERMS } from "@/lib/vocabulary";
import { publicTaskAttachmentUrl, uploadSitePhoto } from "@/services/task-attachment-service";

const STATUS: Record<PhotoStatus, { label: string; tone: string }> = {
    shown: { label: "Shown to client", tone: "bg-success-soft text-success" },
    with_pm: { label: "With PM", tone: "bg-warning-soft text-warning" },
    not_shared: { label: "Not shared", tone: "bg-surface/90 text-ink-secondary" },
};

/**
 * Every photo the viewer took on this project, by task, each saying where it
 * stands: with the PM, shown to the client, or not shared. Open tasks take
 * new photos from here.
 */
export function CrewPhotos({ data, viewerId }: {
    data: CrewProjectData;
    viewerId: string;
}) {
    const router = useRouter();
    const touch = useTouch();
    const { project, tasks, attachments } = data;
    const photos = attachments.filter((a) => a.media_kind === "photo");
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const writable = project.status !== "on_hold" && project.status !== "completed";
    const openMine = tasks.filter((t) => t.assigned_to === viewerId && ["backlog", "to_do", "in_progress"].includes(t.stage));
    const groupIds = [...new Set([...photos.map((p) => p.task_id), ...(writable ? openMine.map((t) => t.id) : [])])];
    const viewer: ViewerPhoto[] = groupIds.flatMap((id) => photos.filter((p) => p.task_id === id)).map((p) => ({
        id: p.id,
        url: publicTaskAttachmentUrl(p.storage_path),
        caption: `${taskById.get(p.task_id)?.title ?? "Task"} · ${STATUS[photoStatus(p.approved_for_client_at, taskById.get(p.task_id)?.stage)].label}`,
    }));
    const [index, setIndex] = React.useState<number | null>(null);
    const [camera, setCamera] = React.useState(false);
    const [target, setTarget] = React.useState<string | null>(null);
    const [uploading, setUploading] = React.useState<string | null>(null);
    // Started when the camera opens, so the fix is ready when the photo comes back.
    const fixRef = React.useRef<Promise<Fix> | null>(null);

    function pick(taskId: string) {
        setTarget(taskId);
        fixRef.current = locate();
        setCamera(true);
    }

    /** Camera photos only: each is stamped, then judged and stored by the server. */
    async function upload(files: FileList | File[] | null) {
        const list = Array.from(files ?? []);
        if (list.length === 0 || !target)
            return;
        const task = taskById.get(target);
        setUploading(target);
        try {
            const fix = fixRef.current ?? locate();
            fixRef.current = null;
            for (const file of list) {
                const ready = await prepareSiteMedia(file, fix, task?.title ?? "Task");
                await uploadSitePhoto(target, ready.file, ready.capture);
                if (!ready.capture.fix)
                    toast.message("Location was off, so this shows the time only. Your PM will see it flagged.");
            }
            toast.success(list.length === 1 ? "Photo added" : `${list.length} photos added`);
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Upload failed. Check your signal and try again.");
        }
        finally {
            setUploading(null);
        }
    }

    if (data.loadFailed)
        return <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">This project&apos;s tasks could not be loaded, so your photos can&apos;t be shown right now. Reload to try again.</p>;
    if (groupIds.length === 0)
        return <p className="materialize rounded-[20px] material px-6 py-7 text-sm text-ink-secondary">Photos you take on this project&apos;s tasks collect here.</p>;

    return (<div className="grid gap-5">
      {touch && writable ? <InAppBrowserNotice/> : null}
      {groupIds.map((id) => {
            const task = taskById.get(id);
            const list = photos.filter((p) => p.task_id === id);
            const canAdd = writable && openMine.some((t) => t.id === id);
            return (<OverviewCard key={id} id={`photos-${id}`} title={task?.title ?? "Task"} count={list.length} aside={task ? TASK_STAGE_TERMS[normalizeBoardStage(task.stage)].label : undefined} className="materialize">
              <ul className="grid grid-cols-2 gap-2.5 px-5 pb-5 sm:grid-cols-3 sm:px-6 lg:grid-cols-4">
                {list.map((p) => {
                    const status = STATUS[photoStatus(p.approved_for_client_at, task?.stage)];
                    const at = viewer.findIndex((v) => v.id === p.id);
                    return (<li key={p.id}>
                      <button type="button" onClick={() => setIndex(at)} className={cn("group press relative block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-sunken", focusRing)}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- site photos from storage */}
                        <img src={publicTaskAttachmentUrl(p.storage_path)} alt={viewer[at]?.caption ?? ""} className="size-full object-cover transition-transform duration-700 ease-spring group-hover:scale-[1.03]"/>
                        <span className={cn("absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[10.5px] font-semibold shadow-card", status.tone)}>{status.label}</span>
                      </button>
                    </li>);
                })}
                {/* Camera only, on phones: a laptop's webcam faces the person, not the work. */}
                {canAdd ? (<li>
                    {touch ? (<button type="button" disabled={uploading !== null} onClick={() => pick(id)} className={cn("press grid aspect-[4/3] w-full place-items-center rounded-2xl border-2 border-dashed border-copper/45 bg-brand-soft/60 text-brand hover:border-copper hover:bg-brand-soft disabled:opacity-60", focusRing)}>
                      {uploading === id ? <Loader2 className="size-6 animate-spin" aria-hidden/> : <span className="flex flex-col items-center gap-1 text-xs font-semibold"><Camera className="size-6" aria-hidden/>Take photo</span>}
                    </button>) : (<p className="grid aspect-[4/3] w-full place-items-center rounded-2xl bg-neutral-soft p-3 text-center text-xs text-ink-secondary"><span><Camera className="mx-auto mb-1 size-5" aria-hidden/>Open this task on your phone to take the photo.</span></p>)}
                  </li>) : null}
              </ul>
            </OverviewCard>);
        })}
      <SiteCamera open={camera} onClose={() => setCamera(false)} onCapture={(file) => void upload([file])}/>
      <PhotoViewer photos={viewer} index={index} onIndex={setIndex} onClose={() => setIndex(null)}/>
    </div>);
}
