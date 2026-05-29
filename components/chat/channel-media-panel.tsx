"use client";
import * as React from "react";
import { Download, FileText, ImageIcon, Inbox, } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { filterAttachmentsByKind, publicAttachmentUrl, } from "@/services/chat-attachment-service";
import type { ChatMessageAttachment } from "@/types/database";
type ChannelMediaPanelProps = {
    attachments: ChatMessageAttachment[];
    className?: string;
    embedded?: boolean;
    onUploadClick?: () => void;
};
function formatBytes(bytes: number | null) {
    if (!bytes)
        return "";
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatWhen(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}
function EmptyMedia({ label, onUploadClick }: {
    label: string;
    onUploadClick?: () => void;
}) {
    return (<div className="flex flex-col items-center justify-center gap-2 px-2 py-10 text-center">
      <Inbox className="h-8 w-8 text-slate-300" aria-hidden/>
      <p className="max-w-[12rem] text-sm text-slate-500">{label}</p>
      {onUploadClick ? (<Button type="button" variant="outline" size="sm" onClick={onUploadClick} className="mt-1 h-8 text-xs">
          Attach in chat
        </Button>) : null}
    </div>);
}
function PhotoVideoGrid({ items }: {
    items: ChatMessageAttachment[];
}) {
    return (<ul className="grid grid-cols-2 gap-2">
      {items.map((item) => {
            const url = publicAttachmentUrl(item.storage_path);
            const isVideo = item.media_kind === "video";
            return (<li key={item.id} className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <a href={url} target="_blank" rel="noopener noreferrer" className="block">
              <div className="relative aspect-square bg-slate-100">
                {isVideo ? (<video src={url} className="h-full w-full object-cover" muted preload="metadata"/>) : (<img src={url} alt={item.file_name} className="h-full w-full object-cover"/>)}
                {isVideo ? (<span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    Video
                  </span>) : null}
              </div>
              <p className="truncate px-2 py-1.5 text-[11px] text-slate-600">{item.file_name}</p>
            </a>
          </li>);
        })}
    </ul>);
}
function FileList({ items }: {
    items: ChatMessageAttachment[];
}) {
    return (<ul className="space-y-1.5">
      {items.map((item) => {
            const url = publicAttachmentUrl(item.storage_path);
            return (<li key={item.id}>
            <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-white px-2.5 py-2 hover:bg-slate-50">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden/>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-900">{item.file_name}</span>
                <span className="text-[11px] text-slate-400">
                  {formatWhen(item.created_at)}
                  {item.byte_size ? ` · ${formatBytes(item.byte_size)}` : ""}
                </span>
              </span>
              <Download className="h-3.5 w-3.5 shrink-0 text-slate-400"/>
            </a>
          </li>);
        })}
    </ul>);
}
function MediaContent({ items, mode, emptyLabel, onUploadClick, }: {
    items: ChatMessageAttachment[];
    mode: "all" | "visual" | "file";
    emptyLabel: string;
    onUploadClick?: () => void;
}) {
    if (items.length === 0) {
        return <EmptyMedia label={emptyLabel} onUploadClick={onUploadClick}/>;
    }
    if (mode === "file") {
        return <FileList items={items}/>;
    }
    if (mode === "visual") {
        return <PhotoVideoGrid items={items}/>;
    }
    const visual = items.filter((i) => i.media_kind === "photo" || i.media_kind === "video");
    const docs = items.filter((i) => i.media_kind === "file");
    return (<div className="space-y-4">
      {visual.length > 0 ? (<section>
          <h4 className="mb-2 text-xs font-medium text-slate-500">Photos & videos</h4>
          <PhotoVideoGrid items={visual}/>
        </section>) : null}
      {docs.length > 0 ? (<section>
          <h4 className="mb-2 text-xs font-medium text-slate-500">Documents</h4>
          <FileList items={docs}/>
        </section>) : null}
    </div>);
}
export function ChannelMediaPanel({ attachments, className, embedded = false, onUploadClick, }: ChannelMediaPanelProps) {
    const visual = React.useMemo(() => attachments.filter((a) => a.media_kind === "photo" || a.media_kind === "video"), [attachments]);
    const files = React.useMemo(() => filterAttachmentsByKind(attachments, "file"), [attachments]);
    return (<div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden bg-white", !embedded && "border border-slate-200", className)}>
      <Tabs defaultValue="all" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-3 grid h-9 w-auto grid-cols-3 gap-1 rounded-md bg-slate-100 p-1">
          <TabsTrigger value="all" className="text-xs data-active:bg-white data-active:shadow-sm">
            All ({attachments.length})
          </TabsTrigger>
          <TabsTrigger value="visual" className="text-xs data-active:bg-white data-active:shadow-sm">
            <ImageIcon className="mr-1 inline h-3 w-3"/>
            Media ({visual.length})
          </TabsTrigger>
          <TabsTrigger value="file" className="text-xs data-active:bg-white data-active:shadow-sm">
            <FileText className="mr-1 inline h-3 w-3"/>
            Files ({files.length})
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <TabsContent value="all" className="mt-0 outline-none">
            <MediaContent items={attachments} mode="all" emptyLabel="Nothing shared yet. Use the paperclip in chat to add files." onUploadClick={onUploadClick}/>
          </TabsContent>
          <TabsContent value="visual" className="mt-0 outline-none">
            <MediaContent items={visual} mode="visual" emptyLabel="No photos or videos yet." onUploadClick={onUploadClick}/>
          </TabsContent>
          <TabsContent value="file" className="mt-0 outline-none">
            <MediaContent items={files} mode="file" emptyLabel="No documents yet." onUploadClick={onUploadClick}/>
          </TabsContent>
        </div>
      </Tabs>
    </div>);
}
