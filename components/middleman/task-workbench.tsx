"use client";
import * as React from "react";
import { Camera, Check, Film, Hourglass, ImagePlus, Images, Loader2, Paperclip, Play, Send, Video } from "lucide-react";
import { toast } from "sonner";
import { focusRing } from "@/components/dashboard/overview-kit";
import { UploadTray, type StagedFile } from "@/components/middleman/upload-tray";
import { nextHandoffAction, normalizeBoardStage, parseChecklist, type ChecklistItem } from "@/lib/board-workflow";
import { hasSiteEvidence, uploadTooBig } from "@/lib/media-kind";
import { traySummary } from "@/lib/upload-tray";
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

const pickButton = cn("press inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-brand-soft px-4 text-sm font-semibold text-brand ring-1 ring-copper/30 hover:bg-brand-soft/70 hover:ring-copper disabled:opacity-50", focusRing);

/**
 * The working part of a task for the person doing it: its checklist, the
 * site photos and videos (camera first on phones) and the next step in reach
 * of a thumb. Picked files wait in a tray to be checked before they upload.
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
    const editable = stage !== "review" && stage !== "done" && !disabledReason;
    const photoRef = React.useRef<HTMLInputElement>(null);
    const videoRef = React.useRef<HTMLInputElement>(null);
    const libraryRef = React.useRef<HTMLInputElement>(null);
    const [staged, setStaged] = React.useState<StagedFile[]>([]);
    const [uploading, setUploading] = React.useState(false);
    const [dragging, setDragging] = React.useState(false);
    const touch = useTouch();
    const needsMedia = handoff?.variant === "submit" && !hasSiteEvidence(attachments);
    const pending = traySummary(staged.map((s) => ({ size: s.file.size, type: s.file.type, status: s.status }))).sendable;

    // Local previews are object URLs; let them go when the card goes.
    const stagedRef = React.useRef(staged);
    React.useEffect(() => {
        stagedRef.current = staged;
    }, [staged]);
    React.useEffect(() => () => stagedRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

    function add(files: FileList | File[] | null) {
        const list = Array.from(files ?? []);
        if (list.length === 0)
            return;
        setStaged((s) => [...s, ...list.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), status: "ready" as const }))]);
        [photoRef, videoRef, libraryRef].forEach((r) => { if (r.current) r.current.value = ""; });
    }
    function remove(id: string) {
        setStaged((s) => {
            const gone = s.find((x) => x.id === id);
            if (gone)
                URL.revokeObjectURL(gone.url);
            return s.filter((x) => x.id !== id);
        });
    }
    function clear() {
        staged.forEach((s) => URL.revokeObjectURL(s.url));
        setStaged([]);
    }

    /** Sends every file that can go, one at a time; failures stay in the tray with their reason. */
    async function uploadAll() {
        const queue = staged.filter((s) => (s.status === "ready" || s.status === "failed") && !uploadTooBig(s.file));
        if (queue.length === 0)
            return;
        setUploading(true);
        const added: TaskAttachment[] = [];
        let failed = 0;
        for (const item of queue) {
            setStaged((s) => s.map((x) => (x.id === item.id ? { ...x, status: "uploading", error: undefined } : x)));
            try {
                added.push(await uploadTaskAttachment(task.project_id, task.id, item.file));
                URL.revokeObjectURL(item.url);
                setStaged((s) => s.filter((x) => x.id !== item.id));
            }
            catch (e) {
                failed += 1;
                const error = e instanceof Error ? e.message : "Check your signal and try again.";
                setStaged((s) => s.map((x) => (x.id === item.id ? { ...x, status: "failed", error } : x)));
            }
        }
        if (added.length > 0)
            onUploaded(added);
        setUploading(false);
        if (failed === 0)
            toast.success(added.length === 1 ? "Uploaded" : `${added.length} files uploaded`);
        else
            toast.error(added.length > 0 ? `${added.length} uploaded, ${failed} didn’t. They’re still in the tray.` : "Nothing uploaded. Check your signal and try again.");
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

        {attachments.length > 0 || editable ? (<div className={cn("mt-6 rounded-2xl transition-[box-shadow,background-color] first:mt-0", dragging && "bg-brand-soft/50 ring-2 ring-copper ring-offset-4 ring-offset-surface")} onDragOver={(e) => {
                if (!editable || !e.dataTransfer.types.includes("Files"))
                    return;
                e.preventDefault();
                setDragging(true);
            }} onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                    setDragging(false);
            }} onDrop={(e) => {
                if (!editable)
                    return;
                e.preventDefault();
                setDragging(false);
                add(e.dataTransfer.files);
            }}>
            <h3 className="text-sm font-semibold text-ink">Photos and videos {attachments.length > 0 ? <span className="font-normal text-ink-tertiary tabular">{attachments.length}</span> : null}</h3>
            {attachments.length > 0 ? (<div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
                {attachments.map((a) => <Thumb key={a.id} item={a}/>)}
              </div>) : editable ? <p className="mt-1 text-[13px] text-ink-tertiary">Show the work: a photo or a short video is enough to submit.</p> : null}
            {editable ? (<div className="mt-3 flex flex-wrap items-center gap-2">
                {touch ? (<>
                    <button type="button" disabled={uploading} onClick={() => photoRef.current?.click()} className={pickButton}><Camera className="size-4" aria-hidden/>Take photo</button>
                    <button type="button" disabled={uploading} onClick={() => videoRef.current?.click()} className={pickButton}><Video className="size-4" aria-hidden/>Record video</button>
                    <button type="button" disabled={uploading} onClick={() => libraryRef.current?.click()} className={pickButton}><Images className="size-4" aria-hidden/>From gallery</button>
                  </>) : (<>
                    <button type="button" disabled={uploading} onClick={() => libraryRef.current?.click()} className={pickButton}><ImagePlus className="size-4" aria-hidden/>Add photos or videos</button>
                    <span className="text-xs text-ink-tertiary">or drop files here · up to 50 MB each</span>
                  </>)}
              </div>) : null}
            {staged.length > 0 ? <UploadTray items={staged} uploading={uploading} onRemove={remove} onClear={clear} onUpload={() => void uploadAll()}/> : null}
          </div>) : null}
        <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => add(e.target.files)}/>
        <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => add(e.target.files)}/>
        <input ref={libraryRef} type="file" accept={touch ? "image/*,video/*" : "image/*,video/*,.pdf"} multiple className="hidden" onChange={(e) => add(e.target.files)}/>
      </div>

      {/* The next step stays in reach of a thumb while the task is on screen; it appears once there is something to submit, so adding photos happens in the section above. */}
      <div className="sticky bottom-0 z-10 rounded-b-[inherit] border-t border-line bg-surface/90 p-4 backdrop-blur-md sm:px-7">
        {disabledReason ? (<p className="flex min-h-14 items-center justify-center rounded-full bg-neutral-soft px-4 text-center text-sm font-medium text-ink-secondary">{disabledReason}</p>) : stage === "review" ? (<p className="flex h-14 items-center justify-center gap-2 rounded-full bg-warning-soft text-[15px] font-medium text-warning">
            <Hourglass className="size-4" aria-hidden/>
            Waiting for your project manager to accept
          </p>) : handoff && !needsMedia && pending === 0 && !uploading ? (<button type="button" disabled={busy} onClick={onAdvance} className={cn("press flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand text-base font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_24px_-10px_rgb(180_83_9/0.6)] hover:bg-brand-hover disabled:opacity-60", focusRing)}>
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden/> : handoff.variant === "submit" ? <Send className="size-5" aria-hidden/> : <Play className="size-5" aria-hidden/>}
            {handoff.variant === "submit" ? "Submit for review" : "Start work"}
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
      {item.media_kind === "photo" ? <img src={url} alt={item.file_name} className="size-full object-cover"/> : item.media_kind === "video" ? (<>
          <video src={`${url}#t=0.1`} preload="metadata" muted playsInline className="size-full object-cover" aria-label={item.file_name}/>
          <span className="absolute grid size-7 place-items-center rounded-full bg-ink/60 text-white" aria-hidden><Film className="size-3.5"/></span>
        </>) : <Paperclip className="size-6" aria-hidden/>}
    </a>);
}
