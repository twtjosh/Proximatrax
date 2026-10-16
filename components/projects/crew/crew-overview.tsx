"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TaskWorkbench } from "@/components/middleman/task-workbench";
import { DiscussionDisclosure } from "@/components/projects/shared/task-discussion";
import { nextHandoffAction, type ChecklistItem } from "@/lib/board-workflow";
import { crewLanes, crewStage, milestoneFeed, nextMove, openWork, siteNext } from "@/lib/crew-project";
import type { CrewProjectData } from "@/lib/data/crew-project";
import { indexAttachmentsByTask, moveTaskToStage } from "@/lib/work-task-flow";
import { claimOpenTask, updateTask, type TaskWithRelations } from "@/services/task-service";
import { NextMove } from "./next-move";
import { OpenWork } from "./open-work";
import { SiteCard } from "./site-card";
import { WorkLanes } from "./work-lanes";
import { YourPart } from "./your-part";

const PAUSED = "Your project manager has paused this project, so work can't move right now.";

/**
 * A middleman's project Overview. What it shows depends on the project:
 * running, paused, nothing for them yet, closed, or unavailable.
 */
export function CrewOverview({ data, viewerId, openTask }: {
    data: CrewProjectData;
    viewerId: string;
    /** `?task=<id>`: the row to open on arrival. */
    openTask: string | null;
}) {
    const router = useRouter();
    const { project, milestones, today } = data;
    // Local copies for instant feedback; a server refresh (live, or after an action) replaces them.
    const [tasks, setTasks] = React.useState(data.tasks);
    const [attachments, setAttachments] = React.useState(data.attachments);
    const [source, setSource] = React.useState(data);
    if (source !== data) {
        setSource(data);
        setTasks(data.tasks);
        setAttachments(data.attachments);
    }
    const [open, setOpen] = React.useState<string | null>(openTask);
    const [busy, setBusy] = React.useState<string | null>(null);

    const sentBack = React.useMemo(() => new Set(Object.keys(data.sentBack)), [data.sentBack]);
    const byTask = React.useMemo(() => indexAttachmentsByTask(attachments), [attachments]);
    const lanes = crewLanes(tasks, viewerId, sentBack);
    const pool = openWork(tasks);
    const mineCount = tasks.filter((t) => t.assigned_to === viewerId).length;
    const stage = crewStage(project.status, mineCount, pool.length, data.loadFailed);
    const next = siteNext(milestoneFeed(milestones, tasks, viewerId, today), today);
    const move = nextMove(tasks, viewerId, sentBack, today);
    const paused = stage === "paused";
    const photoCount = (id: string) => (byTask.get(id) ?? []).filter((a) => a.media_kind === "photo").length;

    React.useEffect(() => {
        if (openTask)
            document.getElementById(`task-${openTask}`)?.scrollIntoView({ block: "center" });
    }, [openTask]);

    function openRow(id: string) {
        setOpen(id);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        requestAnimationFrame(() => document.getElementById(`task-${id}`)?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" }));
    }

    async function advance(task: TaskWithRelations) {
        const handoff = nextHandoffAction(task, "middleman", viewerId);
        if (!handoff)
            return;
        setBusy(task.id);
        try {
            await moveTaskToStage(task, handoff.targetStage, "middleman", viewerId, project.id, handoff.variant === "claim" ? { claimAssigneeId: viewerId } : {});
            toast.success(handoff.variant === "submit" ? "Sent to your project manager for review" : "Started. It's in progress now.");
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "That didn't go through. Try again.");
        }
        finally {
            setBusy(null);
        }
    }

    async function saveChecklist(task: TaskWithRelations, items: ChecklistItem[]) {
        const before = tasks;
        setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, checklist: items } : t)));
        try {
            await updateTask({ id: task.id, checklist: items });
        }
        catch (e) {
            setTasks(before);
            toast.error(e instanceof Error ? e.message : "The checklist didn't save. Try again.");
        }
    }

    async function take(task: TaskWithRelations) {
        setBusy(task.id);
        try {
            if (await claimOpenTask(task.id, viewerId)) {
                setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, assigned_to: viewerId } : t)));
                openRow(task.id);
                toast.success("It's yours. You'll find it under To do.");
            }
            else {
                toast.error("Someone already took this task.");
            }
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't take that task. Try again.");
        }
        finally {
            setBusy(null);
        }
    }

    if (stage === "closed")
        return <YourPart project={project} accepted={lanes.accepted.length} photos={attachments.filter((a) => a.media_kind === "photo").length}/>;
    if (stage === "unavailable")
        return <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">This project&apos;s tasks could not be loaded, so your work here can&apos;t be shown right now. Reload to try again.</p>;

    const workbench = (task: TaskWithRelations) => (<TaskWorkbench task={task} viewerId={viewerId} attachments={byTask.get(task.id) ?? []} busy={busy === task.id} disabledReason={paused ? PAUSED : undefined} onAdvance={() => void advance(task)} onChecklist={(items) => void saveChecklist(task, items)} onUploaded={(added) => setAttachments((list) => [...added, ...list])} footer={<DiscussionDisclosure taskId={task.id} projectId={project.id} taskTitle={task.title} viewerId={viewerId} disabled={paused}/>}/>);

    return (<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid min-w-0 gap-5">
        {paused ? <p role="status" className="materialize rounded-2xl bg-neutral-soft px-4 py-3 text-sm text-ink-secondary">{PAUSED}</p> : null}
        {stage === "idle" ? (<div className="materialize rounded-[20px] material px-6 py-7">
            <p className="text-[17px] font-semibold tracking-[-0.016em] text-ink">Nothing for you here yet</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-secondary">You&apos;ll get a notification when your project manager assigns you work on this project.</p>
          </div>) : null}
        {move && !paused ? <NextMove task={move} today={today} sentBack={sentBack.has(move.id)} photoCount={photoCount(move.id)} busy={busy === move.id} viewerId={viewerId} onAdvance={() => void advance(move)} onOpen={() => openRow(move.id)}/> : null}
        {mineCount > 0 ? <WorkLanes lanes={lanes} today={today} open={open} onToggle={(id) => setOpen((o) => (o === id ? null : id))} photoCount={photoCount} workbench={workbench}/> : null}
        {pool.length > 0 ? <OpenWork tasks={pool} today={today} busy={busy} disabled={paused} onTake={(t) => void take(t)}/> : null}
      </div>
      <SiteCard next={next} team={data.team} viewerId={viewerId}/>
    </div>);
}
