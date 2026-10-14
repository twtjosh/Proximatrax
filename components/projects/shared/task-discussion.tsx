"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Loader2, MessagesSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Face, focusRing } from "@/components/dashboard/overview-kit";
import { SPRING } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ROLE_TERMS } from "@/lib/vocabulary";
import { addTaskComment, deleteTaskComment, listTaskComments, type TaskCommentWithAuthor } from "@/services/task-comment-service";

const when = (iso: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(iso));

/**
 * The conversation about one task between the PM and the crew: questions,
 * measurements, decisions, kept with the work instead of lost in the project
 * chat. Live: a reply from site appears without a reload. Clients don't see it.
 */
export function TaskDiscussion({ taskId, projectId, taskTitle, viewerId, isPm, onCount, disabled }: {
    taskId: string;
    projectId: string;
    taskTitle: string;
    viewerId: string;
    /** The PM can remove anyone's comment; everyone else only their own. */
    isPm: boolean;
    onCount?: (n: number) => void;
    disabled?: boolean;
}) {
    const reduce = useReducedMotion();
    const [comments, setComments] = React.useState<TaskCommentWithAuthor[] | null>(null);
    const [missing, setMissing] = React.useState(false);
    const [text, setText] = React.useState("");
    const [sending, setSending] = React.useState(false);
    const end = React.useRef<HTMLDivElement>(null);
    const onCountRef = React.useRef(onCount);
    React.useEffect(() => {
        onCountRef.current = onCount;
    });

    React.useEffect(() => {
        let live = true;
        listTaskComments(taskId).then((rows) => live && setComments(rows)).catch(() => {
            if (live) {
                setMissing(true);
                setComments([]);
            }
        });
        const sb = createClient();
        const channel = sb.channel(`task-comments-${taskId}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` }, () => {
                // The row has no author join; reading the thread again is simplest and rare.
                void listTaskComments(taskId).then((rows) => live && setComments(rows));
            })
            .on("postgres_changes", { event: "DELETE", schema: "public", table: "task_comments" }, (payload) => {
                const id = (payload.old as { id?: string }).id;
                if (live && id)
                    setComments((list) => list?.filter((c) => c.id !== id) ?? list);
            })
            .subscribe();
        return () => {
            live = false;
            void sb.removeChannel(channel);
        };
    }, [taskId]);

    React.useEffect(() => {
        if (comments) {
            onCountRef.current?.(comments.length);
            end.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
        }
    }, [comments, reduce]);

    async function send() {
        const body = text.trim();
        if (!body || sending)
            return;
        setSending(true);
        try {
            const added = await addTaskComment({ taskId, projectId, taskTitle, body });
            setComments((list) => (list?.some((c) => c.id === added.id) ? list : [...(list ?? []), added]));
            setText("");
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "That comment didn't send.");
        }
        finally {
            setSending(false);
        }
    }

    async function remove(c: TaskCommentWithAuthor) {
        setComments((list) => list?.filter((x) => x.id !== c.id) ?? list);
        try {
            await deleteTaskComment(c.id);
        }
        catch (e) {
            setComments((list) => (list ? [...list, c].sort((a, b) => a.created_at.localeCompare(b.created_at)) : list));
            toast.error(e instanceof Error ? e.message : "That comment couldn't be removed.");
        }
    }

    if (missing)
        return <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">Discussions need the latest database update (migration 0024). Ask your administrator to run it.</p>;

    return (<div className="flex min-h-0 flex-1 flex-col">
      <div className="grid flex-1 content-start gap-4 pb-4">
        {comments === null ? (<p className="flex items-center gap-2 text-sm text-ink-tertiary"><Loader2 className="size-4 animate-spin" aria-hidden/>Loading the discussion…</p>) : comments.length === 0 ? (<div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-8 text-center">
            <MessagesSquare className="size-6 text-ink-tertiary" aria-hidden/>
            <p className="text-sm font-medium text-ink">No discussion yet</p>
            <p className="max-w-64 text-xs text-ink-tertiary">Ask about measurements, materials or a problem on site. Everyone on this task sees it here.</p>
          </div>) : (<ol className="grid gap-4" aria-live="polite">
            <AnimatePresence initial={false}>
              {comments.map((c) => {
                const mine = c.author_id === viewerId;
                const role = c.author?.role === "project_manager" ? "PM" : c.author?.role === "middleman" ? ROLE_TERMS.middleman : null;
                return (<motion.li key={c.id} layout={!reduce} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={SPRING} className="group flex gap-3">
                    <Face person={{ id: c.author_id, name: c.author?.full_name ?? "Someone", avatarUrl: c.author?.avatar_url ?? null, role: "" }} size={30}/>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-2 text-xs">
                        <b className="font-semibold text-ink">{mine ? "You" : c.author?.full_name ?? "Someone"}</b>
                        {role ? <span className="rounded bg-surface-sunken px-1 text-[10px] font-semibold text-ink-secondary">{role}</span> : null}
                        <span className="text-ink-tertiary tabular">{when(c.created_at)}</span>
                        {mine || isPm ? <button type="button" onClick={() => void remove(c)} aria-label="Delete comment" className={cn("ml-auto grid size-6 cursor-pointer place-items-center rounded-md text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger focus-visible:opacity-100", focusRing)}><Trash2 className="size-3.5" aria-hidden/></button> : null}
                      </p>
                      <p className={cn("mt-1 rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap", mine ? "bg-brand-soft text-ink" : "bg-surface-sunken text-ink")}>{c.body}</p>
                    </div>
                  </motion.li>);
            })}
            </AnimatePresence>
          </ol>)}
        <div ref={end}/>
      </div>
      {!disabled ? (<form onSubmit={(e) => {
                e.preventDefault();
                void send();
            }} className="sticky bottom-0 -mx-1 flex items-end gap-2 rounded-2xl bg-surface p-1.5 pl-3.5 shadow-card ring-1 ring-line focus-within:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus-within:ring-brand">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Write a comment</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                }
            }} rows={1} maxLength={4000} placeholder="Write a comment…" className="field-sizing-content max-h-40 min-h-9 w-full resize-none bg-transparent py-2 text-sm leading-relaxed placeholder:text-ink-tertiary focus:outline-none"/>
          </label>
          <button type="submit" disabled={!text.trim() || sending} aria-label="Send comment" className={cn("press grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-brand text-white transition-opacity duration-200 disabled:cursor-default disabled:opacity-35", focusRing)}>
            {sending ? <Loader2 className="size-4 animate-spin" aria-hidden/> : <ArrowUp className="size-4" aria-hidden/>}
          </button>
        </form>) : null}
    </div>);
}
