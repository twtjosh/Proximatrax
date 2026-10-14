"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { normalizeBoardStage, validateStageTransition, type BoardColumnStage, type WorkflowGateContext } from "@/lib/board-workflow";
import { projectReviewPath } from "@/lib/constants";
import { toGateTasks } from "@/lib/milestone-task-gates";
import { moveTaskToStage } from "@/lib/work-task-flow";
import type { TaskWithRelations } from "@/services/task-service";
import type { Milestone, TaskAttachment } from "@/types/database";
import { COLUMNS } from "./board-meta";

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** Sets query params without a server round trip; old `?view=all` links mean the default. */
export function setQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
        if (v)
            next.set(k, v);
        else
            next.delete(k);
    }
    if (next.get("view") === "all")
        next.delete("view");
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

/**
 * What every PM task surface shares (Tasks, Timeline): local copies that change
 * first and give way to the server's on refresh, the open task (`?task=`), and
 * one path for moving work between stages with its rules and Undo.
 */
export function useTaskActions({ projectId, viewerId, closed, milestones, tasks, attachments, comments }: {
    projectId: string;
    viewerId: string;
    closed: boolean;
    milestones: Milestone[];
    tasks: TaskWithRelations[];
    attachments: TaskAttachment[];
    comments: Record<string, number>;
}) {
    const router = useRouter();
    const params = useSearchParams();
    const [items, setItems] = React.useState(tasks);
    const [files, setFiles] = React.useState(attachments);
    const [counts, setCounts] = React.useState(comments);
    const [seen, setSeen] = React.useState({ tasks, attachments, comments });
    if (seen.tasks !== tasks || seen.attachments !== attachments || seen.comments !== comments) {
        setSeen({ tasks, attachments, comments });
        setItems(tasks);
        setFiles(attachments);
        setCounts(comments);
    }

    const gate: WorkflowGateContext = { milestones, tasks: toGateTasks(items) };
    const byTask = React.useMemo(() => {
        const map = new Map<string, TaskAttachment[]>();
        for (const a of files)
            map.set(a.task_id, [...(map.get(a.task_id) ?? []), a]);
        return map;
    }, [files]);

    const openId = params.get("task");
    const open = openId ? items.find((t) => t.id === openId) ?? null : null;
    const openTask = (id: string | null) => setQuery({ task: id });
    /** In review opens Review mode; anything else opens its panel. */
    const show = (t: TaskWithRelations) => (normalizeBoardStage(t.stage) === "review" ? router.push(`${projectReviewPath(projectId)}?task=${t.id}`) : openTask(t.id));

    const patchTask = (id: string, patch: Partial<TaskWithRelations>) => setItems((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));

    async function move(task: TaskWithRelations, to: BoardColumnStage, undoable = true) {
        const from = normalizeBoardStage(task.stage);
        patchTask(task.id, { stage: to });
        try {
            await moveTaskToStage(task, to, "project_manager", viewerId, projectId);
            if (undoable)
                toast.success(`Moved to ${COLUMNS.find((c) => c.stage === to)!.label}`, { description: task.title, action: { label: "Undo", onClick: () => void move({ ...task, stage: to }, from, false) } });
            router.refresh();
        }
        catch (e) {
            patchTask(task.id, { stage: task.stage });
            toast.error(errorText(e, "That move didn't go through."));
        }
    }

    /** Every stage change goes through here: drags, menus, the panel's next step. */
    function requestMove(task: TaskWithRelations, to: BoardColumnStage) {
        const from = normalizeBoardStage(task.stage);
        if (from === to)
            return;
        if (closed) {
            toast.error("This project is closed. Reopen it to change work.");
            return;
        }
        if (from === "review") {
            router.push(`${projectReviewPath(projectId)}?task=${task.id}`);
            return;
        }
        if (from === "done") {
            toast("Accepted work is on the client's record", { description: "Add a new task for anything that needs redoing." });
            return;
        }
        const check = validateStageTransition(task, from, to, "project_manager", gate);
        if (!check.ok) {
            toast.error(check.failures[0]?.message ?? "That move isn't allowed.");
            return;
        }
        if (to === "review" && !(byTask.get(task.id) ?? []).some((a) => a.media_kind === "photo")) {
            toast.error("Add a site photo before submitting for review.", { action: { label: "Open task", onClick: () => openTask(task.id) } });
            return;
        }
        if (check.warning) {
            toast(check.warning, { description: task.title, duration: 8000, action: { label: "Start anyway", onClick: () => void move(task, to) } });
            return;
        }
        void move(task, to);
    }

    /** Everything the task panel needs, spread onto <TaskSheet/>. */
    const sheet = {
        task: open,
        projectId,
        viewerId,
        commentCount: open ? counts[open.id] ?? 0 : 0,
        onCommentCount: (id: string, n: number) => setCounts((c) => (c[id] === n ? c : { ...c, [id]: n })),
        attachments: open ? byTask.get(open.id) ?? [] : [],
        milestones,
        closed,
        gate,
        onClose: () => openTask(null),
        onPatch: patchTask,
        onMove: requestMove,
        onFiles: (taskId: string, list: TaskAttachment[]) => setFiles((all) => [...all.filter((a) => a.task_id !== taskId), ...list]),
        onDeleted: (id: string) => {
            openTask(null);
            setItems((list) => list.filter((t) => t.id !== id));
            router.refresh();
        },
    };

    return { items, setItems, byTask, counts, gate, open, openTask, show, patchTask, requestMove, sheet };
}
