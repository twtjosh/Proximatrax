"use client";
import * as React from "react";
import { AlertCircle, Check, FileText, Loader2, Play, Upload, X } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import { mediaKindFromMime, uploadTooBig } from "@/lib/media-kind";
import { formatDuration, formatSize, traySummary, type TrayStatus } from "@/lib/upload-tray";
import { cn } from "@/lib/utils";

export type StagedFile = { id: string; file: File; url: string; status: TrayStatus; error?: string };

/**
 * Picked files wait here with a preview until the person sends them, so a
 * wrong pick can be taken out before anything uploads. Files over the size
 * limit are marked and never sent; failed ones stay with their reason.
 */
export function UploadTray({ items, uploading, onRemove, onClear, onUpload }: {
    items: StagedFile[];
    uploading: boolean;
    onRemove: (id: string) => void;
    onClear: () => void;
    onUpload: () => void;
}) {
    const summary = traySummary(items.map((i) => ({ size: i.file.size, type: i.file.type, status: i.status })));
    const failed = items.filter((i) => i.status === "failed");
    return (<section aria-label="Ready to upload" className="mt-4 rounded-2xl bg-surface-subtle p-3.5 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-sm font-semibold text-ink">Ready to upload</p>
        <p className="text-xs text-ink-tertiary tabular" aria-live="polite">{summary.text || "Nothing to send yet"}{summary.tooBig > 0 ? <span className="text-danger"> · {summary.tooBig} too big</span> : null}</p>
        <span className="ml-auto flex items-center gap-2">
          <button type="button" disabled={uploading} onClick={onClear} className={cn("press h-9 cursor-pointer rounded-full px-3.5 text-[13px] font-medium text-ink-secondary hover:bg-surface-sunken disabled:opacity-50", focusRing)}>Clear</button>
          <button type="button" disabled={uploading || summary.sendable === 0} onClick={onUpload} className={cn("press inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-white hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-45", focusRing)}>
            {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden/> : <Upload className="size-4" aria-hidden/>}
            {uploading ? "Uploading…" : failed.length > 0 && failed.length === summary.sendable ? "Try again" : `Upload ${summary.sendable || ""}`.trim()}
          </button>
        </span>
      </div>
      <ul className="mt-3 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {items.map((i) => <StagedTile key={i.id} item={i} onRemove={() => onRemove(i.id)} locked={uploading}/>)}
      </ul>
      {failed.length > 0 ? (<ul className="mt-2 grid gap-1 text-xs text-danger" aria-live="polite">
          {failed.map((f) => <li key={f.id} className="flex items-start gap-1.5"><AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden/><span><b className="font-medium">{f.file.name}</b> didn’t upload: {f.error}</span></li>)}
        </ul>) : null}
    </section>);
}

function StagedTile({ item, onRemove, locked }: { item: StagedFile; onRemove: () => void; locked: boolean }) {
    const kind = mediaKindFromMime(item.file.type);
    const tooBig = uploadTooBig(item.file);
    const [duration, setDuration] = React.useState<string | null>(null);
    return (<li className="relative w-24 shrink-0">
      <div className={cn("relative grid size-24 place-items-center overflow-hidden rounded-2xl bg-surface-sunken text-ink-tertiary", (tooBig || item.status === "failed") && "ring-2 ring-danger ring-offset-2 ring-offset-surface-subtle")}>
        {kind === "photo" ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local preview of a picked file
            <img src={item.url} alt="" className="size-full object-cover"/>) : kind === "video" ? (<>
            <video src={`${item.url}#t=0.1`} preload="metadata" muted playsInline onLoadedMetadata={(e) => setDuration(formatDuration(e.currentTarget.duration))} className="size-full object-cover"/>
            <span className="absolute grid size-8 place-items-center rounded-full bg-ink/60 text-white" aria-hidden><Play className="size-4 translate-x-px fill-current"/></span>
            {duration ? <span className="absolute right-1.5 bottom-1.5 rounded-md bg-ink/70 px-1.5 text-[10.5px] font-semibold text-white tabular">{duration}</span> : null}
          </>) : <FileText className="size-7" aria-hidden/>}
        {item.status === "uploading" ? <span className="absolute inset-0 grid place-items-center bg-surface/70"><Loader2 className="size-6 animate-spin text-brand" aria-label="Uploading"/></span> : null}
        {item.status === "done" ? <span className="absolute inset-0 grid place-items-center bg-surface/70"><Check className="size-6 text-success" aria-label="Uploaded"/></span> : null}
      </div>
      {item.status !== "uploading" ? (<button type="button" disabled={locked} onClick={onRemove} aria-label={`Remove ${item.file.name}`} className={cn("absolute -top-2 -right-2 grid size-7 cursor-pointer place-items-center rounded-full bg-ink text-white shadow-[0_2px_6px_rgb(14_18_34/0.3)] hover:bg-ink/85 disabled:opacity-40", focusRing)}>
          <X className="size-3.5" aria-hidden/>
        </button>) : null}
      <p className="mt-1.5 truncate text-[11.5px] text-ink-secondary" title={item.file.name}>{item.file.name}</p>
      <p className={cn("text-[11px] tabular", tooBig ? "font-medium text-danger" : "text-ink-tertiary")}>{tooBig ? `${formatSize(item.file.size)} · over 50 MB` : formatSize(item.file.size)}</p>
    </li>);
}
