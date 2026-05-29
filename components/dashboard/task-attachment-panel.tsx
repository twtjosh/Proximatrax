"use client";
import * as React from "react";
import { Film, ImageIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteTaskAttachment, formatAttachmentSize, publicTaskAttachmentUrl, uploadTaskAttachment, } from "@/services/task-attachment-service";
import type { TaskAttachment } from "@/types/database";
const ACCEPT = "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar";
type TaskAttachmentPanelProps = {
    projectId: string;
    taskId: string;
    attachments: TaskAttachment[];
    onChange: (attachments: TaskAttachment[]) => void;
    canUpload: boolean;
    canDelete: boolean;
    compact?: boolean;
};
function AttachmentPreview({ item }: {
    item: TaskAttachment;
}) {
    const url = publicTaskAttachmentUrl(item.storage_path);
    if (item.media_kind === "photo") {
        return (<a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-sm border border-slate-200">
        
        <img src={url} alt={item.file_name} className="max-h-40 w-full object-cover"/>
      </a>);
    }
    if (item.media_kind === "video") {
        return (<video src={url} controls preload="metadata" className="max-h-40 w-full rounded-sm border border-slate-200 bg-black"/>);
    }
    return (<a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-2.5 py-2 text-xs hover:border-copper/30">
      <Paperclip className="h-3.5 w-3.5 shrink-0 text-copper"/>
      <span className="min-w-0 truncate font-medium">{item.file_name}</span>
    </a>);
}
export function TaskAttachmentPanel({ projectId, taskId, attachments, onChange, canUpload, canDelete, compact, }: TaskAttachmentPanelProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = React.useState(false);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);
    async function handleFiles(files: FileList | null) {
        if (!files?.length || !canUpload)
            return;
        setUploading(true);
        const added: TaskAttachment[] = [];
        try {
            for (const file of Array.from(files)) {
                const attachment = await uploadTaskAttachment(projectId, taskId, file);
                added.push(attachment);
            }
            onChange([...added, ...attachments]);
            toast.success(added.length === 1 ? "Attachment uploaded" : `${added.length} attachments uploaded`);
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Upload failed.");
        }
        finally {
            setUploading(false);
            if (inputRef.current)
                inputRef.current.value = "";
        }
    }
    async function handleDelete(item: TaskAttachment) {
        if (!canDelete)
            return;
        setDeletingId(item.id);
        try {
            await deleteTaskAttachment(item.id, item.storage_path);
            onChange(attachments.filter((a) => a.id !== item.id));
            toast.success("Attachment removed");
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed.");
        }
        finally {
            setDeletingId(null);
        }
    }
    return (<div className={cn("rounded-none border border-slate-100 bg-slate-50/80", compact ? "p-2.5" : "p-3")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Site evidence
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Photos, videos, and files tied to this task.
          </p>
        </div>
        {canUpload ? (<>
            <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)}/>
            <Button type="button" variant="outline" size="sm" disabled={uploading} className="h-8 shrink-0 rounded-none border-copper/30 font-mono text-[10px] uppercase tracking-[0.14em]" onClick={() => inputRef.current?.click()}>
              {uploading ? (<Loader2 className="h-3.5 w-3.5 animate-spin"/>) : (<Upload className="h-3.5 w-3.5"/>)}
              Upload
            </Button>
          </>) : null}
      </div>

      {attachments.length === 0 ? (<p className="mt-3 text-xs text-slate-400">
          {canUpload
                ? "No attachments yet — upload site photos, walkthrough videos, or spec files."
                : "No attachments on this task."}
        </p>) : (<ul className="mt-3 space-y-2">
          {attachments.map((item) => (<li key={item.id} className="space-y-1.5">
              <AttachmentPreview item={item}/>
              <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-slate-500">
                  {item.media_kind === "photo" ? (<ImageIcon className="h-3 w-3 shrink-0"/>) : item.media_kind === "video" ? (<Film className="h-3 w-3 shrink-0"/>) : (<Paperclip className="h-3 w-3 shrink-0"/>)}
                  <span className="truncate">{item.file_name}</span>
                  {item.byte_size ? (<span className="shrink-0 tabular-nums">
                      · {formatAttachmentSize(item.byte_size)}
                    </span>) : null}
                </div>
                {canDelete ? (<button type="button" disabled={deletingId === item.id} onClick={() => void handleDelete(item)} className="shrink-0 text-slate-400 hover:text-red-600 disabled:opacity-50" aria-label={`Remove ${item.file_name}`}>
                    {deletingId === item.id ? (<Loader2 className="h-3.5 w-3.5 animate-spin"/>) : (<Trash2 className="h-3.5 w-3.5"/>)}
                  </button>) : null}
              </div>
            </li>))}
        </ul>)}
    </div>);
}
export function TaskAttachmentIndicator({ attachments, className, }: {
    attachments: TaskAttachment[];
    className?: string;
}) {
    if (attachments.length === 0)
        return null;
    const photo = attachments.filter((a) => a.media_kind === "photo").length;
    const video = attachments.filter((a) => a.media_kind === "video").length;
    const file = attachments.filter((a) => a.media_kind === "file").length;
    return (<span className={cn("inline-flex items-center gap-1 rounded-sm border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-slate-600", className)} title={`${attachments.length} attachment${attachments.length === 1 ? "" : "s"}`}>
      <Paperclip className="h-3 w-3 text-copper"/>
      <span className="tabular-nums">{attachments.length}</span>
      {photo > 0 ? (<span className="inline-flex items-center gap-0.5 text-slate-500">
          <ImageIcon className="h-2.5 w-2.5"/>
          {photo}
        </span>) : null}
      {video > 0 ? (<span className="inline-flex items-center gap-0.5 text-slate-500">
          <Film className="h-2.5 w-2.5"/>
          {video}
        </span>) : null}
      {file > 0 && photo === 0 && video === 0 ? (<span className="text-slate-500">file</span>) : null}
    </span>);
}
