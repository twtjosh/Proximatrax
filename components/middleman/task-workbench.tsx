"use client";
import * as React from "react";
import { Camera, Check, Film, Hourglass, ImagePlus, Loader2, Paperclip, Play, Send } from "lucide-react";
import { toast } from "sonner";
import { focusRing } from "@/components/dashboard/overview-kit";
import { nextHandoffAction, normalizeBoardStage, parseChecklist, type ChecklistItem } from "@/lib/board-workflow";
import { cn } from "@/lib/utils";
import { publicTaskAttachmentUrl, uploadTaskAttachment } from "@/services/task-attachment-service";
import type { TaskWithRelations } from "@/services/task-service";
import type { TaskAttachment } from "@/types/database";

const COARSE = "(pointer: coarse)";
const subscribeCoarse = (onChange: () => void) => {
    const mq = window.matchMedia(COARSE);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
};
/** True on phones and tablets, where the camera input opens the rear camera. */
export function useTouch() {
    return React.useSyncExternalStore(subscribeCoarse, () => window.matchMedia(COARSE).matches, () => false);
}

/**
 * The working part of a task for the person doing it: its checklist, site
 * photos (camera first on phones) and the next step in reach of a thumb.
 * Shared by Today's focus card and the project page's work lanes, so a task
 * behaves the same everywhere. `disabledReason` turns every action off and
 * says why.
 */
export function TaskWorkbench({ task, viewerId, attachments, busy, disabledReason, onAdvance, onChecklist, onUploaded, footer }: {
    task: TaskWithRelations;
    viewerId: string;
    attachments: TaskAttachment[];
    busy: boolean;
    disabledReason?: string;
    onAdvance: () => void;
    onChecklist: (items: ChecklistItem[]) => void;
    onUploaded: (added: TaskAttachment[]) => void;
    footer?: React.ReactNode;
}) {
    const stage = normalizeBoardStage(task.stage);
    const handoff = disabledReason ? null : nextHandoffAction(task, "middleman", viewerId);
    const checklist = parseChecklist(task.checklist);
    const done = checklist.filter((c) => c.done).length;
    const photos = attachments.filter((a) => a.media_kind === "photo").length;
    const editable = stage !== "review" && stage !== "done" && !disabledReason;
    const cameraRef = React.useRef<HTMLInputElement>(null);
    const libraryRef = React.useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = React.useState(false);
    const needsPhoto = handoff?.variant === "submit" && photos === 0;
    const touch = useTouch();
    const PhotoIcon = touch ? Camera : ImagePlus;

    async function upload(files: FileList | null) {
        if (!files?.length)
            return;
        setUploading(true);
        const added: TaskAttachment[] = [];
        try {
            for (const file of Array.from(files))
                added.push(await uploadTaskAttachment(task.project_id, task.id, file));
            onUploaded(added);
            toast.success(added.length === 1 ? "Photo added" : `${added.length} files added`);
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Upload failed. Check your signal and try again.");
        }
        finally {
            setUploading(false);
            if (cameraRef.current)
                cameraRef.current.value = "";
            if (libraryRef.current)
                libraryRef.current.value = "";
        }
    }

    return (<>
      <div className="px-5 pb-5 sm:px-7 sm:pb-7">
        {checklist.length > 0 ? (<div className="mt-6 first:mt-0">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">Checklist</h3>
              <p className="text-xs font-medium text-ink-secondary tabular">{done} of {checklist.length} done</p>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
              <div className="h-full rounded-full bg-copper transition-[width] duration-500 ease-spring" style={{ width: `${(done / checklist.length) * 100}%` }}/>
            </div>
            <ul className="mt-3 grid gap-1">
              {checklist.map((item) => (<li key={item.id}>
                  <button type="button" role="checkbox" aria-checked={item.done} disabled={!editable} onClick={() => onChecklist(checklist.map((c) => (c.id === item.id ? { ...c, done: !c.done } : c)))} className={cn("press flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl px-3 text-left text-[15px] hover:bg-surface-sunken disabled:cursor-default disabled:hover:bg-transparent", focusRing)}>
                    <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300 ease-spring", item.done ? "border-copper bg-copper text-white" : "border-line-strong")}>
                      {item.done ? <Check className="size-3.5" strokeWidth={3}/> : null}
                    </span>
                    <span className={cn("transition-colors duration-300", item.done ? "text-ink-tertiary line-through decoration-line-strong" : "text-ink")}>{item.label}</span>
                  </button>
                </li>))}
            </ul>
          </div>) : null}

        {attachments.length > 0 || editable ? (<div className="mt-6 first:mt-0">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">Site photos {attachments.length > 0 ? <span className="font-normal text-ink-tertiary tabular">{attachments.length}</span> : null}</h3>
              {editable && touch ? (<button type="button" onClick={() => libraryRef.current?.click()} className={cn("rounded-sm text-xs font-medium text-brand hover:underline", focusRing)}>Upload from gallery</button>) : null}
            </div>
            <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {attachments.map((a) => <Thumb key={a.id} item={a}/>)}
              {editable ? (<button type="button" disabled={uploading} onClick={() => cameraRef.current?.click()} className={cn("press grid size-20 shrink-0 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-copper/45 bg-brand-soft/60 text-brand hover:border-copper hover:bg-brand-soft", focusRing)} aria-label={touch ? "Take a site photo" : "Add a file"}>
                  {uploading ? <Loader2 className="size-6 animate-spin" aria-hidden/> : <span className="flex flex-col items-center gap-1 text-[11px] font-semibold"><PhotoIcon className="size-6" aria-hidden/>{touch ? "Take photo" : "Add"}</span>}
                </button>) : null}
            </div>
          </div>) : null}
        <input ref={cameraRef} type="file" accept={touch ? "image/*" : "image/*,video/*,.pdf"} capture={touch ? "environment" : undefined} multiple={!touch} className="hidden" onChange={(e) => void upload(e.target.files)}/>
        <input ref={libraryRef} type="file" accept="image/*,video/*,.pdf" multiple className="hidden" onChange={(e) => void upload(e.target.files)}/>
      </div>

      {/* The next step stays in reach of a thumb while the task is on screen. */}
      <div className="sticky bottom-0 z-10 rounded-b-[inherit] border-t border-line bg-surface/90 p-4 backdrop-blur-md sm:px-7">
        {disabledReason ? (<p className="flex min-h-14 items-center justify-center rounded-full bg-neutral-soft px-4 text-center text-sm font-medium text-ink-secondary">{disabledReason}</p>) : stage === "review" ? (<p className="flex h-14 items-center justify-center gap-2 rounded-full bg-warning-soft text-[15px] font-medium text-warning">
            <Hourglass className="size-4" aria-hidden/>
            Waiting for your project manager to accept
          </p>) : handoff ? (<button type="button" disabled={busy || uploading} onClick={needsPhoto ? () => cameraRef.current?.click() : onAdvance} className={cn("press flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand text-base font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_24px_-10px_rgb(180_83_9/0.6)] hover:bg-brand-hover disabled:opacity-60", focusRing)}>
            {busy || uploading ? <Loader2 className="size-5 animate-spin" aria-hidden/> : needsPhoto ? <PhotoIcon className="size-5" aria-hidden/> : handoff.variant === "submit" ? <Send className="size-5" aria-hidden/> : <Play className="size-5" aria-hidden/>}
            {uploading ? "Uploading…" : needsPhoto ? (touch ? "Take a photo to submit" : "Add a photo to submit") : handoff.variant === "submit" ? "Submit for review" : "Start work"}
          </button>) : null}
        {footer}
      </div>
    </>);
}

function Thumb({ item }: {
    item: TaskAttachment;
}) {
    const url = publicTaskAttachmentUrl(item.storage_path);
    return (<a href={url} target="_blank" rel="noopener noreferrer" className={cn("press relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-sunken text-ink-tertiary", focusRing)} title={item.file_name}>
      {/* eslint-disable-next-line @next/next/no-img-element -- site photos from storage, shown small */}
      {item.media_kind === "photo" ? <img src={url} alt={item.file_name} className="size-full object-cover"/> : item.media_kind === "video" ? <Film className="size-6" aria-hidden/> : <Paperclip className="size-6" aria-hidden/>}
    </a>);
}
