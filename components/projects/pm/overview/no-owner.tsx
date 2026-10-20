"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { focusRing, OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import { projectBoardPath } from "@/lib/constants";
import { daysBetween, formatDate } from "@/lib/dashboard";
import type { PmTask } from "@/lib/pm-project";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";
import { AssignMenu, assignTask } from "../assign-menu";

/** Rows shown before the card hands off to the Board. */
const SHOWN = 6;

/**
 * Open tasks no one has been given. They can't start, and they stay off the
 * timeline, until someone has them; assigning one here sends it on its way.
 */
export function NoOwner({ projectId, tasks, people, today, closed }: {
    projectId: string;
    tasks: PmTask[];
    people: Profile[];
    today: string;
    closed: boolean;
}) {
    const router = useRouter();
    // Assigned here but not yet refreshed from the server: off the card at once.
    const [given, setGiven] = React.useState<ReadonlySet<string>>(() => new Set());
    const open = tasks
        .filter((t) => !t.assigned_to && t.stage !== "done" && !given.has(t.id))
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    if (!open.length)
        return null;

    async function assign(t: PmTask, p: Profile | null) {
        if (!p)
            return;
        setGiven((s) => new Set(s).add(t.id));
        try {
            await assignTask(projectId, t, p);
            toast.success(`${p.full_name.split(" ")[0]} has "${t.title}"`);
            router.refresh();
        }
        catch (e) {
            setGiven((s) => {
                const n = new Set(s);
                n.delete(t.id);
                return n;
            });
            toast.error(e instanceof Error ? e.message : "That change didn't save.");
        }
    }

    return (<OverviewCard id="no-owner" title="No one assigned" count={open.length} sub="Off the timeline until someone has them" aside={<Link href={projectBoardPath(projectId, { assignee: "none" })} className={cn("rounded-sm font-medium text-ink-secondary hover:text-ink", focusRing)}>Board</Link>} className="materialize" style={stagger(3)}>
      <ul className="pb-2">
        {open.slice(0, SHOWN).map((t) => {
            const late = t.due_date !== null && t.due_date < today;
            return (<li key={t.id} className="flex items-center gap-3 border-t border-line px-5 py-3 first:border-t-0 sm:px-6">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-ink-tertiary"><UserRound className="size-3.5" aria-hidden/></span>
              <Link href={`${projectBoardPath(projectId)}?task=${t.id}`} className={cn("group min-w-0 flex-1 rounded-md", focusRing)}>
                <span className="block truncate text-sm font-medium text-ink group-hover:underline">{t.title}</span>
                <span className={cn("block text-xs tabular", late ? "font-semibold text-danger" : "text-ink-tertiary")}>
                  {t.due_date ? (late ? `${daysBetween(t.due_date, today)}d late` : t.due_date === today ? "Due today" : `Due ${formatDate(t.due_date, { month: "short", day: "numeric" })}`) : "No date yet"}
                </span>
              </Link>
              {!closed ? (<AssignMenu task={t} owner={null} people={people} onAssign={(p) => void assign(t, p)} className="press inline-flex h-8 shrink-0 cursor-pointer items-center rounded-full bg-surface-sunken px-3 text-xs font-semibold text-ink hover:bg-line data-popup-open:bg-line">
                  Assign
                </AssignMenu>) : null}
            </li>);
        })}
      </ul>
      {open.length > SHOWN ? (<Link href={projectBoardPath(projectId, { assignee: "none" })} className={cn("mx-5 mb-4 block rounded-md text-xs font-medium text-ink-secondary hover:text-ink sm:mx-6", focusRing)}>
          {open.length - SHOWN} more on the Board
        </Link>) : null}
    </OverviewCard>);
}
