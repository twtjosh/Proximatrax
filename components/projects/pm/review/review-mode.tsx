"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";
import { focusRing } from "@/components/dashboard/overview-kit";
import { projectPath } from "@/lib/constants";
import { SPRING } from "@/lib/motion";
import { reviewQueue } from "@/lib/review-queue";
import { cn } from "@/lib/utils";
import { acceptTaskDeliverable, sendTaskBackToActive } from "@/lib/work-task-flow";
import { publicTaskAttachmentUrl } from "@/services/task-attachment-service";
import type { TaskWithRelations } from "@/services/task-service";
import type { TaskAttachment } from "@/types/database";
import { Submission, type Outcome } from "./submission";

const subscribeNever = () => () => {};
/** How long Accept waits before it commits, so Undo can cancel it. */
const UNDO_MS = 4000;

/**
 * The PM's review: every submission waiting on them, one at a time, full
 * screen over the project. Accept shares the work with the client along with
 * the photos the PM keeps; Send back returns it with a reason the crew sees
 * on the task's checklist. Esc leaves; leaving commits any pending Accept.
 */
export function ReviewMode({ projectId, tasks, attachments, initialTask }: {
    projectId: string;
    tasks: TaskWithRelations[];
    attachments: TaskAttachment[];
    /** `?task=<id>`: open on this submission. */
    initialTask: string | null;
}) {
    const router = useRouter();
    const reduce = useReducedMotion();
    // The portal needs document.body, which only exists in the browser.
    const mounted = React.useSyncExternalStore(subscribeNever, () => true, () => false);
    // Tasks the PM already decided on in this visit, hidden while the server catches up.
    const [decided, setDecided] = React.useState<Set<string>>(() => new Set());
    const [selectedId, setSelectedId] = React.useState<string | null>(initialTask);
    const [outcome, setOutcome] = React.useState<Outcome>("none");
    const root = React.useRef<HTMLDivElement>(null);
    const pending = React.useRef(new Map<string, { timer: number; commit: () => Promise<void> }>());
    const queue = reviewQueue(tasks).filter((t) => !decided.has(t.id));
    const index = Math.max(queue.findIndex((t) => t.id === selectedId), 0);
    const task = queue[index] ?? null;
    const byTask = React.useMemo(() => {
        const map = new Map<string, TaskAttachment[]>();
        for (const a of attachments)
            map.set(a.task_id, [...(map.get(a.task_id) ?? []), a]);
        return map;
    }, [attachments]);

    const leave = React.useCallback(() => {
        if (document.referrer.startsWith(window.location.origin) && window.history.length > 1)
            router.back();
        else
            router.push(projectPath(projectId));
    }, [projectId, router]);

    // Leaving commits whatever is still waiting out its undo window.
    React.useEffect(() => {
        const waiting = pending.current;
        return () => {
            for (const [, p] of waiting) {
                window.clearTimeout(p.timer);
                void p.commit();
            }
            waiting.clear();
        };
    }, []);

    // Focus the layer so Esc and the review keys work straight away.
    React.useEffect(() => root.current?.focus(), [mounted]);

    function step(by: number) {
        if (queue.length < 2)
            return;
        setOutcome("none");
        setSelectedId(queue[(index + by + queue.length) % queue.length].id);
    }

    function decide(t: TaskWithRelations, kind: Outcome) {
        setOutcome(kind);
        const next = queue[index + 1] ?? queue[index - 1] ?? null;
        setDecided((d) => new Set(d).add(t.id));
        setSelectedId(next?.id ?? null);
    }

    function accept(t: TaskWithRelations, photoIds: string[]) {
        decide(t, "accepted");
        const commit = async () => {
            pending.current.delete(t.id);
            try {
                const result = await acceptTaskDeliverable(t, projectId, undefined, { photoIds });
                if (result.milestoneCompleted)
                    toast.success(`${result.milestoneCompleted} is delivered`, { description: "Every task in it is accepted." });
                router.refresh();
            }
            catch (e) {
                setDecided((d) => {
                    const n = new Set(d);
                    n.delete(t.id);
                    return n;
                });
                toast.error(e instanceof Error ? e.message : `"${t.title}" couldn't be accepted. It is back in the queue.`);
            }
        };
        const timer = window.setTimeout(() => void commit(), UNDO_MS);
        pending.current.set(t.id, { timer, commit });
        toast.success(`Accepted "${t.title}"`, {
            description: photoIds.length > 0 ? `The client will see it with ${photoIds.length} ${photoIds.length === 1 ? "photo" : "photos"}.` : "The client will see it without photos.",
            duration: UNDO_MS,
            action: {
                label: "Undo",
                onClick: () => {
                    const p = pending.current.get(t.id);
                    if (!p)
                        return;
                    window.clearTimeout(p.timer);
                    pending.current.delete(t.id);
                    setDecided((d) => {
                        const n = new Set(d);
                        n.delete(t.id);
                        return n;
                    });
                    setOutcome("none");
                    setSelectedId(t.id);
                },
            },
        });
    }

    async function sendBack(t: TaskWithRelations, reason: string) {
        decide(t, "sent_back");
        try {
            await sendTaskBackToActive(t, projectId, undefined, reason);
            toast.success(`Sent back to ${t.assignee?.full_name.split(" ")[0] ?? "the crew"}`, { description: `"Fix: ${reason}" is now on their checklist.` });
            router.refresh();
        }
        catch (e) {
            setDecided((d) => {
                const n = new Set(d);
                n.delete(t.id);
                return n;
            });
            toast.error(e instanceof Error ? e.message : "That didn't go through. Try again.");
        }
    }

    if (!mounted)
        return null;
    return createPortal(<motion.div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Review submissions" initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} className="fixed inset-0 z-40 flex flex-col bg-canvas text-ink outline-none" onKeyDown={(e) => {
            if (e.key === "Escape" && !(e.target as HTMLElement).closest("textarea"))
                leave();
        }}>
      <header className="flex items-center gap-4 border-b border-line bg-surface/80 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-tertiary">Review</p>
          <p className="text-[15px] font-semibold tracking-[-0.01em]" aria-live="polite">{queue.length === 0 ? "All caught up" : `${queue.length} waiting on you`}</p>
        </div>
        <p className="text-xs text-ink-tertiary max-md:hidden"><kbd className="rounded bg-surface-sunken px-1.5 font-sans font-semibold">A</kbd> accept · <kbd className="rounded bg-surface-sunken px-1.5 font-sans font-semibold">S</kbd> send back · <kbd className="rounded bg-surface-sunken px-1.5 font-sans font-semibold">J</kbd> <kbd className="rounded bg-surface-sunken px-1.5 font-sans font-semibold">K</kbd> move</p>
        <button type="button" onClick={leave} aria-label="Close review" className={cn("press grid size-10 cursor-pointer place-items-center rounded-full bg-surface-sunken hover:bg-line", focusRing)}><X className="size-5" aria-hidden/></button>
      </header>

      {queue.length === 0 ? (<CaughtUp onLeave={leave}/>) : (<div className="grid min-h-0 flex-1 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <nav aria-label="Waiting for review" className="min-h-0 overflow-y-auto border-line p-3 max-lg:flex max-lg:gap-2 max-lg:overflow-x-auto max-lg:border-b lg:border-r">
            <ul className="grid gap-1.5 max-lg:flex">
              {queue.map((t) => {
                    const photos = (byTask.get(t.id) ?? []).filter((a) => a.media_kind === "photo");
                    const active = t.id === task?.id;
                    return (<li key={t.id} className="max-lg:w-60 max-lg:shrink-0">
                    <button type="button" onClick={() => { setOutcome("none"); setSelectedId(t.id); }} aria-current={active} className={cn("relative isolate flex w-full cursor-pointer items-center gap-3 rounded-2xl p-2.5 text-left transition-colors duration-300", active ? "text-ink" : "text-ink-secondary hover:bg-surface-sunken", focusRing)}>
                      {active ? <motion.span layoutId="review-current" transition={SPRING} aria-hidden className="absolute inset-0 -z-10 rounded-2xl bg-surface shadow-card ring-1 ring-line"/> : null}
                      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-sunken text-ink-tertiary">
                        {/* eslint-disable-next-line @next/next/no-img-element -- site photo thumbnail */}
                        {photos[0] ? <img src={publicTaskAttachmentUrl(photos[0].storage_path)} alt="" className="size-full object-cover"/> : <Camera className="size-5" aria-hidden/>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{t.title}</span>
                        <span className={cn("block truncate text-xs", photos.length === 0 ? "font-medium text-warning" : "text-ink-tertiary")}>
                          {t.assignee?.full_name.split(" ")[0] ?? "Unassigned"} · {photos.length === 0 ? "No photos" : `${photos.length} ${photos.length === 1 ? "photo" : "photos"}`}
                        </span>
                      </span>
                    </button>
                  </li>);
                })}
            </ul>
          </nav>
          <main className="min-h-0 overflow-y-auto">
            <AnimatePresence mode="popLayout" initial={false} custom={outcome}>
              {task ? <Submission key={task.id} task={task} attachments={byTask.get(task.id) ?? []} outcome={outcome} position={`${index + 1} of ${queue.length}`} onAccept={(ids) => accept(task, ids)} onSendBack={(reason) => void sendBack(task, reason)} onStep={step}/> : null}
            </AnimatePresence>
          </main>
        </div>)}
    </motion.div>, document.body);
}

/** Nothing waiting: a check draws itself. */
function CaughtUp({ onLeave }: {
    onLeave: () => void;
}) {
    const reduce = useReducedMotion();
    return (<div className="grid flex-1 place-items-center p-6">
      <div className="grid justify-items-center gap-4 text-center">
        <svg viewBox="0 0 64 64" className="size-20 text-stage-done" aria-hidden>
          <motion.circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="3" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} opacity={0.25}/>
          <motion.path d="M20 33 l8 8 l16 -18" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}/>
        </svg>
        <div>
          <h2 className="text-[1.4rem] font-semibold tracking-[-0.025em]">All caught up</h2>
          <p className="mt-1 text-sm text-ink-secondary">New submissions land here live.</p>
        </div>
        <button type="button" onClick={onLeave} className={cn("press mt-1 inline-flex h-10 cursor-pointer items-center rounded-full bg-surface-sunken px-5 text-sm font-medium hover:bg-line", focusRing)}>Back to the project</button>
      </div>
    </div>);
}
