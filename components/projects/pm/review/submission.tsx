"use client";
import * as React from "react";
import { motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Camera, Check, Expand, FileText, Film, Loader2, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { Face, focusRing, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { useTouch } from "@/components/middleman/task-workbench";
import { PhotoViewer } from "@/components/projects/shared/photo-viewer";
import { parseChecklist } from "@/lib/board-workflow";
import { BUSINESS_TIME_ZONE } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { publicTaskAttachmentUrl } from "@/services/task-attachment-service";
import type { TaskWithRelations } from "@/services/task-service";
import type { TaskAttachment } from "@/types/database";

export type Outcome = "none" | "accepted" | "sent_back";

const REASONS = ["Needs clearer photos", "Redo the finish", "Doesn't match the spec"];
const when = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: BUSINESS_TIME_ZONE });
/** How far a swipe must travel, as a share of the card, to decide. */
const SWIPE = 0.3;

const variants = {
    enter: { opacity: 0, y: 18 },
    center: { opacity: 1, y: 0, x: 0, scale: 1 },
    exit: (outcome: Outcome) => (outcome === "accepted" ? { opacity: 0, y: -56, scale: 0.96 } : outcome === "sent_back" ? { opacity: 0, x: -140 } : { opacity: 0, transition: { duration: 0.12 } }),
};

/**
 * One submission under review: its photos (each can be kept from the
 * client), what was done, and the decision. Keys: A accept, S send back,
 * J / K move. On a phone the card swipes: right accepts, left sends back.
 */
export function Submission({ task, attachments, outcome, position, onAccept, onSendBack, onStep }: {
    task: TaskWithRelations;
    attachments: TaskAttachment[];
    /** How the previous card left; drives its exit. */
    outcome: Outcome;
    position: string;
    onAccept: (photoIds: string[]) => void;
    onSendBack: (reason: string) => void;
    onStep: (by: number) => void;
}) {
    const reduce = useReducedMotion();
    const touch = useTouch();
    const photos = attachments.filter((a) => a.media_kind === "photo");
    const videos = attachments.filter((a) => a.media_kind === "video");
    const files = attachments.filter((a) => a.media_kind !== "photo" && a.media_kind !== "video");
    const [excluded, setExcluded] = React.useState<Set<string>>(() => new Set());
    const [shown, setShown] = React.useState(0);
    const [viewer, setViewer] = React.useState<number | null>(null);
    const [sending, setSending] = React.useState(false);
    const [reason, setReason] = React.useState("");
    const [stamp, setStamp] = React.useState(false);
    const reasonRef = React.useRef<HTMLTextAreaElement>(null);
    const card = React.useRef<HTMLElement>(null);
    const x = useMotionValue(0);
    const acceptTint = useTransform(x, [0, 160], [0, 0.18]);
    const backTint = useTransform(x, [-160, 0], [0.18, 0]);
    const keep = photos.filter((p) => !excluded.has(p.id)).map((p) => p.id);
    const checklist = parseChecklist(task.checklist);
    const current = photos[Math.min(shown, photos.length - 1)];

    const accept = () => {
        if (stamp)
            return;
        setStamp(true);
        window.setTimeout(() => onAccept(keep), reduce ? 0 : 520);
    };
    const startSendBack = () => {
        setSending(true);
        requestAnimationFrame(() => reasonRef.current?.focus());
    };
    const submitSendBack = () => {
        if (reason.trim())
            onSendBack(reason.trim());
    };

    const onKey = React.useEffectEvent((e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey)
            return;
        const typing = (e.target as HTMLElement | null)?.closest("input, textarea, select");
        if (typing) {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setSending(false);
            }
            return;
        }
        const key = e.key.toLowerCase();
        if (key === "a")
            accept();
        else if (key === "s")
            startSendBack();
        else if (key === "j")
            onStep(1);
        else if (key === "k")
            onStep(-1);
        else
            return;
        e.preventDefault();
    });
    React.useEffect(() => {
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const toggle = (id: string) => setExcluded((s) => {
        const n = new Set(s);
        if (n.has(id))
            n.delete(id);
        else
            n.add(id);
        return n;
    });

    return (<motion.article ref={card} custom={outcome} variants={variants} initial={reduce ? false : "enter"} animate="center" exit="exit" transition={SPRING} drag={touch && !sending ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.55} style={{ x }} onDragEnd={(_, info) => {
            const width = card.current?.offsetWidth ?? 360;
            if (info.offset.x > width * SWIPE)
                accept();
            else if (info.offset.x < -width * SWIPE)
                startSendBack();
        }} className="relative mx-auto grid max-w-4xl gap-6 p-4 pb-32 sm:p-8 sm:pb-32">
      <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-[28px] bg-stage-done" style={{ opacity: acceptTint }}/>
      <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-[28px] bg-stage-review" style={{ opacity: backTint }}/>

      <div className="relative overflow-hidden rounded-[24px] material">
        {current ? (<button type="button" onClick={() => setViewer(Math.min(shown, photos.length - 1))} aria-label="Open photos full size" className={cn("group relative block w-full cursor-zoom-in", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- site photo from storage */}
            <img key={current.id} src={publicTaskAttachmentUrl(current.storage_path)} alt={current.file_name} draggable={false} className={cn("materialize aspect-[4/3] w-full object-cover transition-[filter,opacity] duration-500 sm:aspect-[16/10]", excluded.has(current.id) && "opacity-55 grayscale")}/>
            <span className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-surface/90 text-ink opacity-0 shadow-card transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden><Expand className="size-4"/></span>
          </button>) : videos[0] ? (<SiteVideo item={videos[0]} className="aspect-4/3 sm:aspect-16/10"/>) : (<div className="grid aspect-16/7 place-items-center bg-warning-soft text-warning">
            <span className="grid justify-items-center gap-2 text-sm font-medium"><Camera className="size-7" aria-hidden/>No photos or videos were attached</span>
          </div>)}
        {stamp ? (<motion.span initial={{ opacity: 0, scale: 1.8, rotate: -14 }} animate={{ opacity: 1, scale: 1, rotate: -8 }} transition={{ type: "spring", bounce: 0.35, duration: 0.45 }} className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-stage-done bg-surface/85 px-6 py-2 text-2xl font-black tracking-[0.08em] text-success uppercase backdrop-blur-sm">
            Accepted
          </motion.span>) : null}
      </div>

      {photos.length > 0 ? (<div className="relative grid gap-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <p className="font-medium text-ink-secondary"><ShieldCheck className="mr-1 inline size-3.5 align-[-2px] text-success" aria-hidden/>The client will see <b className="text-ink tabular">{keep.length} of {photos.length}</b> {photos.length === 1 ? "photo" : "photos"}</p>
            <p className="text-ink-tertiary max-sm:hidden">Untick a photo to keep it from the client</p>
          </div>
          <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {photos.map((p, i) => {
                    const kept = !excluded.has(p.id);
                    return (<li key={p.id} className="relative shrink-0">
                    <button type="button" onClick={() => setShown(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === shown} className={cn("block size-20 cursor-pointer overflow-hidden rounded-xl ring-2 transition-[box-shadow,opacity] duration-300", i === shown ? "ring-ink" : "ring-transparent hover:ring-line-strong", !kept && "opacity-50", focusRing)}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- site photo thumbnail */}
                      <img src={publicTaskAttachmentUrl(p.storage_path)} alt="" className={cn("size-full object-cover", !kept && "grayscale")}/>
                    </button>
                    <button type="button" role="checkbox" aria-checked={kept} aria-label={kept ? `Photo ${i + 1} is shared with the client` : `Photo ${i + 1} stays with the team`} onClick={() => toggle(p.id)} className={cn("absolute -top-1.5 -right-1.5 grid size-6 cursor-pointer place-items-center rounded-full ring-2 ring-canvas transition-colors duration-300", kept ? "bg-stage-done text-white" : "bg-surface text-ink-tertiary", focusRing)}>
                      {kept ? <Check className="size-3.5" strokeWidth={3} aria-hidden/> : <span className="size-2 rounded-full bg-line-strong" aria-hidden/>}
                    </button>
                  </li>);
                })}
          </ul>
        </div>) : null}

      {videos.length > (current ? 0 : 1) ? (<div className="relative grid gap-2">
          <p className="text-xs font-medium text-ink-secondary"><Film className="mr-1 inline size-3.5 align-[-2px]" aria-hidden/>{current ? `${videos.length} ${videos.length === 1 ? "video" : "videos"}` : `${videos.length - 1} more ${videos.length === 2 ? "video" : "videos"}`} · stays between you and the crew</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {videos.slice(current ? 0 : 1).map((v) => <li key={v.id}><SiteVideo item={v} className="aspect-video rounded-2xl"/></li>)}
          </ul>
        </div>) : null}

      <div className="relative grid gap-4">
        <div>
          <p className="text-xs text-ink-tertiary tabular">{position}{task.milestone ? ` · ${task.milestone.title}` : ""}</p>
          <h2 className="mt-1 text-[clamp(1.4rem,2.6vw,1.9rem)] leading-tight font-semibold tracking-[-0.03em] text-balance">{task.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-secondary">
            {task.assignee ? (<span className="inline-flex items-center gap-2">
                <Face person={{ id: task.assignee.id, name: task.assignee.full_name, avatarUrl: task.assignee.avatar_url, role: "" }} size={24}/>
                {task.assignee.full_name}
              </span>) : null}
            <span className="tabular text-ink-tertiary">Submitted {when.format(new Date(task.updated_at))}</span>
          </div>
        </div>
        {checklist.length > 0 ? (<ul className="grid gap-1.5 rounded-2xl bg-surface-subtle p-4 ring-1 ring-line">
            {checklist.map((c) => (<li key={c.id} className="flex items-center gap-2.5 text-sm">
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", c.done ? "bg-stage-done text-white" : "border-2 border-line-strong")} aria-hidden>{c.done ? <Check className="size-3" strokeWidth={3}/> : null}</span>
                <span className={c.done ? "text-ink" : "text-ink-secondary"}>{c.label}</span>
                <span className="sr-only">{c.done ? "done" : "not done"}</span>
              </li>))}
          </ul>) : null}
        {task.description ? <p className="max-w-prose text-[15px] leading-relaxed text-ink-secondary">{task.description}</p> : null}
        {files.length > 0 ? (<ul className="flex flex-wrap gap-2">
            {files.map((f) => (<li key={f.id}><a href={publicTaskAttachmentUrl(f.storage_path)} target="_blank" rel="noopener noreferrer" className={cn(softAction, "h-9")}><FileText aria-hidden/>{f.file_name}</a></li>))}
          </ul>) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/90 px-4 py-3 backdrop-blur-xl lg:left-[20rem]">
        <div className="mx-auto max-w-4xl sm:px-4">
          {sending ? (<form onSubmit={(e) => { e.preventDefault(); submitSendBack(); }} className="grid gap-2.5">
              <div className="flex flex-wrap gap-1.5">
                {REASONS.map((r) => <button key={r} type="button" onClick={() => setReason(r)} className={cn("press h-8 cursor-pointer rounded-full px-3 text-xs font-medium", reason === r ? "bg-ink text-white" : "bg-surface-sunken text-ink-secondary hover:text-ink", focusRing)}>{r}</button>)}
              </div>
              <div className="flex items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">What needs fixing</span>
                  <textarea ref={reasonRef} value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitSendBack();
                    }
                }} rows={1} placeholder="What needs fixing? The crew sees this on their checklist." className="block max-h-28 min-h-11 w-full resize-none rounded-2xl border border-line bg-surface px-4 py-2.5 text-[15px] focus:border-brand focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none"/>
                </label>
                <button type="button" onClick={() => setSending(false)} className={cn(softAction, "h-11 px-4")}>Cancel</button>
                <button type="submit" disabled={!reason.trim()} className={cn(primaryAction, "h-11 bg-ink hover:bg-ink/85 disabled:opacity-50")}><Send aria-hidden/>Send back</button>
              </div>
            </form>) : (<div className="flex items-center gap-2">
              <button type="button" onClick={startSendBack} className={cn(softAction, "h-12 flex-1 justify-center text-sm sm:flex-none sm:px-6")}><RotateCcw aria-hidden/>Send back<kbd className="ml-1 rounded bg-surface px-1.5 font-sans text-[11px] text-ink-tertiary max-sm:hidden">S</kbd></button>
              <button type="button" disabled={stamp} onClick={accept} className={cn(primaryAction, "h-12 flex-[2] justify-center text-sm sm:ml-auto sm:flex-none sm:px-8")}>{stamp ? <Loader2 className="animate-spin" aria-hidden/> : <Check aria-hidden/>}Accept{keep.length > 0 ? ` with ${keep.length} ${keep.length === 1 ? "photo" : "photos"}` : ""}<kbd className="ml-1 rounded bg-white/20 px-1.5 font-sans text-[11px] max-sm:hidden">A</kbd></button>
            </div>)}
          {touch && !sending ? <p className="mt-1.5 text-center text-[11px] text-ink-tertiary">Swipe the card right to accept, left to send back</p> : null}
        </div>
      </div>

      <PhotoViewer photos={photos.map((p, i) => ({ id: p.id, url: publicTaskAttachmentUrl(p.storage_path), caption: `${task.title} · photo ${i + 1}${excluded.has(p.id) ? " · kept from the client" : ""}` }))} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)}/>
    </motion.article>);
}

/** A site video the PM can play in place. Pointer presses stay on the player, so scrubbing never swipes the card. */
function SiteVideo({ item, className }: { item: { storage_path: string; file_name: string }; className?: string }) {
    return (<video src={publicTaskAttachmentUrl(item.storage_path)} controls preload="metadata" playsInline aria-label={item.file_name} onPointerDownCapture={(e) => e.stopPropagation()} className={cn("block w-full bg-ink object-contain", className)}/>);
}
