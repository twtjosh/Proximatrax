"use client";
import { focusRing } from "@/components/dashboard/overview-kit";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import { updateTask } from "@/services/task-service";
import { notifyWorkReadyAfterProjectTaskChange, snapshotProjectTasksForNotify } from "@/services/work-notification-service";
import type { Profile } from "@/types/database";

type AssignableTask = { id: string; title: string; assigned_to: string | null };

/**
 * Saves who does a task (or no one), tells the new owner their work is
 * ready, and logs it. Callers show the change first and put it back if this
 * throws.
 */
export async function assignTask(projectId: string, task: AssignableTask, person: Profile | null) {
    const snapshot = person ? await snapshotProjectTasksForNotify(projectId) : null;
    await updateTask({ id: task.id, assigned_to: person?.id ?? null });
    if (snapshot)
        void notifyWorkReadyAfterProjectTaskChange(projectId, snapshot);
    void logActivity({ project_id: projectId, action_type: "task_updated", details: { task_id: task.id, title: task.title } });
}

/** Picks who does a task, or No one. */
export function AssignMenu({ task, owner, people, onAssign, className, children }: {
    task: AssignableTask;
    /** The current owner's name, for the trigger's label. */
    owner: string | null;
    people: Profile[];
    onAssign: (person: Profile | null) => void;
    className: string;
    children: React.ReactNode;
}) {
    return (<DropdownMenu>
      <DropdownMenuTrigger aria-label={`Who does ${task.title}: ${owner ?? "no one yet"}`} className={cn(className, focusRing)}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 min-w-48 overflow-y-auto">
        {people.map((p) => <DropdownMenuItem key={p.id} disabled={p.id === task.assigned_to} onClick={() => onAssign(p)}>{p.full_name}{p.role === "project_manager" ? " (you)" : ""}</DropdownMenuItem>)}
        <DropdownMenuSeparator/>
        <DropdownMenuItem disabled={!task.assigned_to} onClick={() => onAssign(null)}>No one</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>);
}
