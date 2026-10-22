"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, Download, Eye, EyeOff, FileText, FolderInput, Grid2x2, List, Loader2, MoreHorizontal, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { focusRing, primaryAction } from "@/components/dashboard/overview-kit";
import { PhotoViewer } from "@/components/projects/shared/photo-viewer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { deleteProjectFile, updateProjectFile, uploadProjectFile } from "@/services/project-file-service";
import { publicTaskAttachmentUrl } from "@/services/task-attachment-service";
import type { ProjectFile, ProjectFileFolder } from "@/types/database";

type Folder = ProjectFileFolder | "all" | "photos";
const FOLDERS: { key: ProjectFileFolder; label: string; hint: string }[] = [
    { key: "drawings", label: "Drawings", hint: "Shop drawings, floor plans, elevations, details" },
    { key: "designs", label: "Designs", hint: "Renders, mood boards, material and finish selections" },
    { key: "contracts", label: "Contracts & permits", hint: "Signed scope, quotations, permits, approvals" },
    { key: "other", label: "Other", hint: "Anything else the project needs to keep" },
];
export type SitePhoto = { id: string; url: string; taskTitle: string; by: string; at: string; shared: boolean };

const ext = (name: string) => (name.includes(".") ? name.split(".").pop()!.toUpperCase().slice(0, 4) : "FILE");
const EXT_TONE: Record<string, string> = { PDF: "bg-[#fdecec] text-[#c3262e]", DWG: "bg-[#e8f1fd] text-[#1f6fd1]", DXF: "bg-[#e8f1fd] text-[#1f6fd1]", XLS: "bg-[#e6f6ee] text-[#167a4a]", XLSX: "bg-[#e6f6ee] text-[#167a4a]", CSV: "bg-[#e6f6ee] text-[#167a4a]", DOC: "bg-[#e9efff] text-[#2b4fc7]", DOCX: "bg-[#e9efff] text-[#2b4fc7]" };
const size = (b: number | null) => (b === null ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const isImage = (f: Pick<ProjectFile, "mime_type">) => f.mime_type.startsWith("image/");
const day = (iso: string) => formatDate(iso.slice(0, 10), { month: "short", day: "numeric", year: "numeric" });
const download = (f: ProjectFile) => `${publicTaskAttachmentUrl(f.storage_path)}?download=${encodeURIComponent(f.file_name)}`;

/**
 * The project's documents in one place, replacing the paper folder: drawings,
 * designs, contracts, plus every site photo the crew took. Drop files anywhere
 * on the page to add them to the open folder. The PM decides what the client
 * can see.
 */
export function ProjectFiles({ projectId, files, missing, photos, people, closed }: {
    projectId: string;
    files: ProjectFile[];
    /** Migration 0024 hasn't run: the library can't be stored yet. */
    missing: boolean;
    photos: SitePhoto[];
    people: Record<string, string>;
    closed: boolean;
}) {
    const router = useRouter();
    const reduce = useReducedMotion();
    const [items, setItems] = React.useState(files);
    const [seen, setSeen] = React.useState(files);
    if (seen !== files) {
        setSeen(files);
        setItems(files);
    }
    const [folder, setFolder] = React.useState<Folder>("all");
    const [layout, setLayout] = React.useState<"grid" | "list">("grid");
    const [query, setQuery] = React.useState("");
    const [uploading, setUploading] = React.useState<{ id: string; name: string }[]>([]);
    const [dragOver, setDragOver] = React.useState(false);
    const [viewer, setViewer] = React.useState<{ list: { id: string; url: string; caption: string }[]; index: number } | null>(null);
    const input = React.useRef<HTMLInputElement>(null);
    const dragDepth = React.useRef(0);

    const target: ProjectFileFolder = folder === "all" || folder === "photos" ? "other" : folder;
    const needle = query.trim().toLowerCase();
    const shown = items.filter((f) => (folder === "all" || f.folder === folder) && (!needle || f.file_name.toLowerCase().includes(needle)));
    const shownPhotos = photos.filter((p) => !needle || p.taskTitle.toLowerCase().includes(needle));
    const count = (k: Folder) => (k === "all" ? items.length : k === "photos" ? photos.length : items.filter((f) => f.folder === k).length);
    const canUpload = !closed && !missing && folder !== "photos";

    async function upload(list: FileList | File[] | null) {
        if (!list || !canUpload)
            return;
        const all = Array.from(list);
        if (!all.length)
            return;
        const pending = all.map((f) => ({ id: crypto.randomUUID(), name: f.name }));
        setUploading((u) => [...u, ...pending]);
        let ok = 0;
        for (const [i, file] of all.entries()) {
            try {
                const added = await uploadProjectFile(projectId, target, file);
                setItems((list2) => [added, ...list2]);
                ok += 1;
            }
            catch (e) {
                toast.error(`${file.name} didn't upload`, { description: e instanceof Error ? e.message : undefined });
            }
            finally {
                setUploading((u) => u.filter((x) => x.id !== pending[i].id));
            }
        }
        if (ok)
            toast.success(`Added ${ok} ${ok === 1 ? "file" : "files"} to ${FOLDERS.find((f) => f.key === target)!.label}`);
        router.refresh();
    }

    async function patch(f: ProjectFile, p: Partial<Pick<ProjectFile, "folder" | "shared_with_client_at">>, message: string) {
        setItems((list) => list.map((x) => (x.id === f.id ? { ...x, ...p } : x)));
        try {
            await updateProjectFile(f.id, p);
            toast.success(message);
        }
        catch (e) {
            setItems((list) => list.map((x) => (x.id === f.id ? f : x)));
            toast.error(e instanceof Error ? e.message : "That didn't save.");
        }
    }
    async function remove(f: ProjectFile) {
        setItems((list) => list.filter((x) => x.id !== f.id));
        try {
            await deleteProjectFile(f);
            toast.success(`Deleted ${f.file_name}`);
        }
        catch (e) {
            setItems((list) => [f, ...list]);
            toast.error(e instanceof Error ? e.message : "That file couldn't be deleted.");
        }
    }
    const toggleShare = (f: ProjectFile) => void patch(f, { shared_with_client_at: f.shared_with_client_at ? null : new Date().toISOString() }, f.shared_with_client_at ? `The client no longer sees ${f.file_name}` : `The client can now see ${f.file_name}`);
    function open(f: ProjectFile) {
        if (isImage(f)) {
            const images = shown.filter(isImage);
            setViewer({ list: images.map((x) => ({ id: x.id, url: publicTaskAttachmentUrl(x.storage_path), caption: x.file_name })), index: images.findIndex((x) => x.id === f.id) });
        }
        else
            window.open(publicTaskAttachmentUrl(f.storage_path), "_blank", "noopener");
    }

    return (<div className="grid gap-4 pt-2 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start" onDragEnter={(e) => {
            if (!canUpload || !e.dataTransfer.types.includes("Files"))
                return;
            dragDepth.current += 1;
            setDragOver(true);
        }} onDragLeave={() => {
            dragDepth.current = Math.max(dragDepth.current - 1, 0);
            if (!dragDepth.current)
                setDragOver(false);
        }} onDragOver={(e) => canUpload && e.preventDefault()} onDrop={(e) => {
            e.preventDefault();
            dragDepth.current = 0;
            setDragOver(false);
            void upload(e.dataTransfer.files);
        }}>
      <nav aria-label="Folders" className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] lg:sticky lg:top-[calc(var(--frame-stick,0px)+1rem)] lg:grid lg:gap-0.5">
        {([{ key: "all", label: "All files" }, ...FOLDERS] as { key: Folder; label: string }[]).map((f) => <FolderButton key={f.key} on={folder === f.key} label={f.label} count={count(f.key)} onClick={() => setFolder(f.key)}/>)}
        <span className="mx-1 w-px shrink-0 bg-line lg:mx-3 lg:my-2 lg:h-px lg:w-auto" aria-hidden/>
        <FolderButton on={folder === "photos"} label="Site photos" count={photos.length} icon={<Camera className="size-4" aria-hidden/>} onClick={() => setFolder("photos")}/>
      </nav>

      <section aria-label={folder === "photos" ? "Site photos" : "Files"} className="relative grid min-w-0 gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex h-9 min-w-0 flex-1 items-center sm:max-w-72">
            <Search className="pointer-events-none absolute left-3 size-4 text-ink-tertiary" aria-hidden/>
            <span className="sr-only">Search files</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={folder === "photos" ? "Search by task" : "Search files"} className="h-9 w-full rounded-full border border-line bg-surface pr-3 pl-9 text-sm placeholder:text-ink-tertiary focus:border-brand focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none"/>
          </label>
          {folder !== "photos" ? (<div role="radiogroup" aria-label="Layout" className="flex rounded-full bg-surface-sunken p-1">
              {([["grid", Grid2x2, "Grid"], ["list", List, "List"]] as const).map(([k, Icon, label]) => (<button key={k} type="button" role="radio" aria-checked={layout === k} aria-label={label} onClick={() => setLayout(k)} className={cn("relative isolate grid h-7 w-8 cursor-pointer place-items-center rounded-full transition-colors duration-300", layout === k ? "text-ink" : "text-ink-tertiary hover:text-ink", focusRing)}>
                  {layout === k ? <motion.span layoutId="files-layout" transition={SPRING} className="absolute inset-0 -z-10 rounded-full bg-surface shadow-card"/> : null}
                  <Icon className="size-3.5" aria-hidden/>
                </button>))}
            </div>) : null}
          {canUpload ? (<button type="button" onClick={() => input.current?.click()} className={cn(primaryAction, "ml-auto h-9 px-4")}><Upload aria-hidden/>Upload</button>) : null}
          <input ref={input} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => {
                void upload(e.target.files);
                e.target.value = "";
            }}/>
        </div>

        {missing ? <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">The file library needs the latest database update (migration 0024). Site photos still show below.</p> : null}

        <AnimatePresence>
          {dragOver ? (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-[24px] border-2 border-dashed border-brand bg-brand-soft/80 backdrop-blur-sm">
              <p className="grid justify-items-center gap-2 text-center text-sm font-semibold text-brand-hover"><Upload className="size-7" aria-hidden/>Drop to add to {FOLDERS.find((f) => f.key === target)!.label}</p>
            </motion.div>) : null}
        </AnimatePresence>

        {folder === "photos" ? (shownPhotos.length === 0 ? <Empty title="No site photos yet" text="Photos the crew attach to their tasks collect here, newest first."/> : (<ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {shownPhotos.map((p, i) => (<motion.li key={p.id} initial={reduce ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...SPRING, delay: Math.min(i, 12) * 0.025 }} className="group relative">
                  <button type="button" onClick={() => setViewer({ list: shownPhotos.map((x) => ({ id: x.id, url: x.url, caption: `${x.taskTitle} · ${x.by}` })), index: i })} className={cn("block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-2xl bg-surface-sunken", focusRing)}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- site photo */}
                    <img src={p.url} alt={p.taskTitle} loading="lazy" className="size-full object-cover transition-transform duration-500 ease-spring group-hover:scale-[1.04]"/>
                  </button>
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/65 to-transparent px-3 pt-8 pb-2 text-white">
                    <span className="block truncate text-xs font-semibold">{p.taskTitle}</span>
                    <span className="block text-[11px] opacity-80">{p.by} · {day(p.at)}</span>
                  </span>
                  {p.shared ? <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-semibold text-success">Client sees</span> : null}
                </motion.li>))}
            </ul>)) : shown.length === 0 && uploading.length === 0 ? (<Empty title={folder === "all" ? "No files yet" : `Nothing in ${FOLDERS.find((f) => f.key === folder)!.label}`} text={folder === "all" ? "Keep the drawings, designs and signed documents here instead of on paper. Drop files anywhere on this page." : `${FOLDERS.find((f) => f.key === folder)!.hint}. Drop files here or use Upload.`} action={canUpload ? () => input.current?.click() : undefined}/>) : layout === "grid" ? (<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {uploading.map((u) => <li key={u.id} className="grid aspect-[4/5] place-items-center rounded-2xl border border-dashed border-line p-4 text-center text-xs text-ink-tertiary"><span className="grid justify-items-center gap-2"><Loader2 className="size-5 animate-spin" aria-hidden/><span className="line-clamp-2 break-all">{u.name}</span></span></li>)}
              <AnimatePresence initial={false}>
                {shown.map((f) => (<motion.li key={f.id} layout={!reduce} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={SPRING} className="group relative overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line transition-shadow duration-300 hover:shadow-card-hover">
                    <button type="button" onClick={() => open(f)} className={cn("block w-full cursor-pointer text-left", focusRing)}>
                      <span className="grid aspect-[4/3] place-items-center overflow-hidden bg-surface-sunken">
                        {isImage(f)
                        // eslint-disable-next-line @next/next/no-img-element -- uploaded document image
                        ? <img src={publicTaskAttachmentUrl(f.storage_path)} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 ease-spring group-hover:scale-[1.04]"/>
                        : <span className={cn("grid size-16 place-items-center rounded-2xl text-sm font-bold tracking-wide", EXT_TONE[ext(f.file_name)] ?? "bg-surface text-ink-secondary")}>{ext(f.file_name)}</span>}
                      </span>
                      <span className="block p-3">
                        <span className="block truncate text-sm font-medium text-ink">{f.file_name}</span>
                        <span className="block truncate text-xs text-ink-tertiary">{[size(f.byte_size), day(f.created_at)].filter(Boolean).join(" · ")}</span>
                      </span>
                    </button>
                    {f.shared_with_client_at ? <span className="pointer-events-none absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2 py-0.5 text-[10px] font-semibold text-success shadow-card"><Eye className="size-3" aria-hidden/>Client sees</span> : null}
                    <FileMenu f={f} closed={closed} people={people} onShare={() => toggleShare(f)} onMove={(to) => void patch(f, { folder: to }, `Moved to ${FOLDERS.find((x) => x.key === to)!.label}`)} onDelete={() => void remove(f)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100 max-md:opacity-100"/>
                  </motion.li>))}
              </AnimatePresence>
            </ul>) : (<div className="materialize overflow-hidden rounded-[22px] material">
              <ul>
                {uploading.map((u) => <li key={u.id} className="flex items-center gap-3 border-b border-line px-4 py-3 text-sm text-ink-tertiary"><Loader2 className="size-4 animate-spin" aria-hidden/>{u.name}</li>)}
                {shown.map((f) => (<li key={f.id} className="group flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-surface-subtle">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-[10px] font-bold", isImage(f) ? "bg-surface-sunken text-ink-secondary" : EXT_TONE[ext(f.file_name)] ?? "bg-surface-sunken text-ink-secondary")}>{isImage(f) ? <FileText className="size-4" aria-hidden/> : ext(f.file_name)}</span>
                    <button type="button" onClick={() => open(f)} className={cn("min-w-0 flex-1 cursor-pointer text-left", focusRing)}>
                      <span className="block truncate text-sm font-medium text-ink group-hover:underline">{f.file_name}</span>
                      <span className="block truncate text-xs text-ink-tertiary">{FOLDERS.find((x) => x.key === f.folder)!.label} · {people[f.uploaded_by] ?? "Someone"}</span>
                    </button>
                    {f.shared_with_client_at ? <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success max-sm:hidden">Client sees</span> : null}
                    <span className="w-20 shrink-0 text-right text-xs text-ink-tertiary tabular max-sm:hidden">{size(f.byte_size)}</span>
                    <span className="w-28 shrink-0 text-right text-xs text-ink-tertiary tabular max-md:hidden">{day(f.created_at)}</span>
                    <FileMenu f={f} closed={closed} people={people} onShare={() => toggleShare(f)} onMove={(to) => void patch(f, { folder: to }, `Moved to ${FOLDERS.find((x) => x.key === to)!.label}`)} onDelete={() => void remove(f)}/>
                  </li>))}
              </ul>
            </div>)}
      </section>

      <PhotoViewer photos={viewer?.list ?? []} index={viewer?.index ?? null} onIndex={(i) => setViewer((v) => (v ? { ...v, index: i } : v))} onClose={() => setViewer(null)}/>
    </div>);
}

function FolderButton({ on, label, count, icon, onClick }: {
    on: boolean;
    label: string;
    count: number;
    icon?: React.ReactNode;
    onClick: () => void;
}) {
    return (<button type="button" onClick={onClick} aria-current={on || undefined} className={cn("relative isolate flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors duration-300", on ? "text-ink" : "text-ink-secondary hover:bg-surface-sunken hover:text-ink", focusRing)}>
      {on ? <motion.span layoutId="files-folder" transition={SPRING} className="absolute inset-0 -z-10 rounded-xl bg-surface shadow-card ring-1 ring-line"/> : null}
      {icon}
      <span className="truncate">{label}</span>
      <span className="ml-auto pl-2 text-xs text-ink-tertiary tabular">{count}</span>
    </button>);
}

function FileMenu({ f, closed, people, onShare, onMove, onDelete, className }: {
    f: ProjectFile;
    closed: boolean;
    people: Record<string, string>;
    onShare: () => void;
    onMove: (to: ProjectFileFolder) => void;
    onDelete: () => void;
    className?: string;
}) {
    return (<DropdownMenu>
      <DropdownMenuTrigger aria-label={`Actions for ${f.file_name}`} className={cn("grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-surface/95 text-ink-secondary shadow-card transition-opacity hover:text-ink", focusRing, className)}>
        <MoreHorizontal className="size-4" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <p className="px-2 py-1.5 text-xs text-ink-tertiary">Added by {people[f.uploaded_by] ?? "someone"}</p>
        <DropdownMenuItem onClick={() => window.open(download(f), "_blank", "noopener")}><Download aria-hidden/>Download</DropdownMenuItem>
        {!closed ? (<>
            <DropdownMenuItem onClick={onShare}>{f.shared_with_client_at ? <EyeOff aria-hidden/> : <Eye aria-hidden/>}{f.shared_with_client_at ? "Hide from client" : "Share with client"}</DropdownMenuItem>
            <DropdownMenuSeparator/>
            {FOLDERS.filter((x) => x.key !== f.folder).map((x) => <DropdownMenuItem key={x.key} onClick={() => onMove(x.key)}><FolderInput aria-hidden/>Move to {x.label}</DropdownMenuItem>)}
            <DropdownMenuSeparator/>
            <DropdownMenuItem onClick={onDelete} className="text-danger focus:text-danger"><Trash2 aria-hidden/>Delete</DropdownMenuItem>
          </>) : null}
      </DropdownMenuContent>
    </DropdownMenu>);
}

function Empty({ title, text, action }: {
    title: string;
    text: string;
    action?: () => void;
}) {
    return (<div className="grid justify-items-center gap-2 rounded-[24px] border border-dashed border-line-strong px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-surface-sunken text-ink-tertiary"><FileText className="size-5" aria-hidden/></span>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-sm text-ink-secondary">{text}</p>
      {action ? <button type="button" onClick={action} className={cn(primaryAction, "mt-2 h-9 px-4")}><Upload aria-hidden/>Upload files</button> : null}
    </div>);
}
