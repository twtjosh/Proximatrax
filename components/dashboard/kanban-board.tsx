"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DragDropContext, Draggable, Droppable, type DropResult, } from "@hello-pangea/dnd";
import { Calendar, ChevronDown, ChevronRight, GripVertical, Loader2, Lock, Paperclip, Plus, Search, SlidersHorizontal, Trash2, X, } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { removeRealtimeChannelByName } from "@/lib/supabase/realtime-channel";
import { projectBoardPath, TASK_STAGE_LABELS } from "@/lib/constants";
import { BOARD_COLUMN_META, BOARD_STAGES, boardHealthStats, checklistProgress, nextHandoffAction, normalizeBoardStage, parseChecklist, taskBlockedReason, validateStageTransition, type BoardColumnStage, type ChecklistItem, type GateFailure, type WorkflowGateContext, } from "@/lib/board-workflow";
import { toGateTasks } from "@/lib/milestone-task-gates";
import { toTaskNotifySnapshots } from "@/lib/work-ready-notifications";
import { BoardWorkflowBar } from "@/components/dashboard/board-workflow-bar";
import { TaskAttachmentIndicator, TaskAttachmentPanel, } from "@/components/dashboard/task-attachment-panel";
import { cn } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import { indexAttachmentsByTask, listTaskAttachmentsForProject, uploadTaskAttachment, approveTaskAttachmentsForClient, } from "@/services/task-attachment-service";
import { createTask, deleteTask, listTasksForProject, updateTask, type TaskWithRelations, } from "@/services/task-service";
import { listMilestones, listProfilesByRoles, syncMilestoneFromLinkedTasks } from "@/services/project-service";
import { dismissWorkNotificationsForTask, notifyWorkReadyAfterProjectTaskChange, } from "@/services/work-notification-service";
import type { Profile, Milestone, TaskAttachment } from "@/types/database";
import type { TaskStage, TaskPriority, UserRole } from "@/types/enums";
const REVIEW_WIP_SOFT_LIMIT = 5;
const STAGE_ABBR: Record<BoardColumnStage, string> = {
    to_do: "TD",
    in_progress: "IP",
    review: "RV",
    done: "DN",
};
const COLUMN_SHELL: Record<BoardColumnStage, {
    shell: string;
    header: string;
    body: string;
    drop: string;
    title: string;
    hint: string;
    abbr: string;
}> = {
    to_do: {
        shell: "border-slate-200/90",
        header: "border-t-4 border-t-slate-400 bg-slate-100/95",
        body: "bg-slate-50/55",
        drop: "bg-slate-100/75",
        title: "text-slate-800",
        hint: "text-slate-600",
        abbr: "text-slate-600",
    },
    in_progress: {
        shell: "border-sky-200/80",
        header: "border-t-4 border-t-sky-500 bg-sky-100/75",
        body: "bg-sky-50/40",
        drop: "bg-sky-100/70",
        title: "text-sky-950",
        hint: "text-sky-700/80",
        abbr: "text-sky-700",
    },
    review: {
        shell: "border-copper/25",
        header: "border-t-4 border-t-copper bg-copper-soft/60",
        body: "bg-copper-soft/25",
        drop: "bg-copper-soft/50",
        title: "text-copper-hover",
        hint: "text-copper/90",
        abbr: "text-copper-hover",
    },
    done: {
        shell: "border-emerald-200/75",
        header: "border-t-4 border-t-emerald-500 bg-emerald-100/70",
        body: "bg-emerald-50/35",
        drop: "bg-emerald-100/65",
        title: "text-emerald-950",
        hint: "text-emerald-700/85",
        abbr: "text-emerald-700",
    },
};
function mergeToDoColumn(tasks: TaskWithRelations[]): TaskWithRelations[] {
    const backlog = tasks
        .filter((t) => t.stage === "backlog")
        .sort((a, b) => a.position - b.position);
    const todo = tasks
        .filter((t) => t.stage === "to_do")
        .sort((a, b) => a.position - b.position);
    return [...backlog, ...todo];
}
function partitionBoard(tasks: TaskWithRelations[]) {
    return {
        to_do: mergeToDoColumn(tasks),
        in_progress: tasks
            .filter((t) => t.stage === "in_progress")
            .sort((a, b) => a.position - b.position),
        review: tasks
            .filter((t) => t.stage === "review")
            .sort((a, b) => a.position - b.position),
        done: tasks
            .filter((t) => t.stage === "done")
            .sort((a, b) => a.position - b.position),
    };
}
const PRIORITY_LABEL: Record<TaskPriority, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
};
function initials(name: string) {
    return name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}
function todayIso() {
    return new Date().toISOString().slice(0, 10);
}
function isOverdue(due: string | null, stage: TaskStage) {
    if (!due || stage === "done")
        return false;
    return due < todayIso();
}
function ChecklistEditor({ items, onChange, disabled, }: {
    items: ChecklistItem[];
    onChange: (items: ChecklistItem[]) => void;
    disabled?: boolean;
}) {
    const [draft, setDraft] = React.useState("");
    function toggle(id: string) {
        onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
    }
    function remove(id: string) {
        onChange(items.filter((i) => i.id !== id));
    }
    function addItem() {
        const label = draft.trim();
        if (!label)
            return;
        onChange([...items, { id: crypto.randomUUID(), label, done: false }]);
        setDraft("");
    }
    return (<div className="rounded-none border border-slate-100 bg-slate-50/80 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
        Deliverable checklist
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Required before submitting work for PM inspection.
      </p>
      <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
        {items.length === 0 ? (<li className="text-slate-400">No checklist items yet.</li>) : (items.map((item) => (<li key={item.id} className="flex items-center gap-2">
              <input type="checkbox" checked={item.done} disabled={disabled} onChange={() => toggle(item.id)} className="accent-[#d97706]"/>
              <span className={cn("flex-1", item.done && "text-slate-400 line-through")}>
                {item.label}
              </span>
              {!disabled ? (<button type="button" onClick={() => remove(item.id)} className="text-slate-400 hover:text-red-600" aria-label="Remove item">
                  <X className="h-3.5 w-3.5"/>
                </button>) : null}
            </li>)))}
      </ul>
      {!disabled ? (<div className="mt-3 flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add checklist item…" className="h-8 rounded-none text-sm" onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                }
            }}/>
          <Button type="button" variant="outline" className="h-8 shrink-0 rounded-none px-2" onClick={addItem}>
            <Plus className="h-3.5 w-3.5"/>
          </Button>
        </div>) : null}
    </div>);
}
function FilterChip({ active, onClick, children, }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (<button type="button" onClick={onClick} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200", active
            ? "border-copper/50 bg-copper-soft text-copper-hover shadow-[0_1px_8px_-2px_rgba(217,119,6,0.35)]"
            : "border-slate-200/90 bg-white text-slate-600 hover:border-copper/35 hover:bg-slate-50 hover:text-slate-900")}>
      {children}
    </button>);
}
type PmBoardFiltersProps = {
    searchDraft: string;
    setSearchDraft: (value: string) => void;
    onSearchCommit: () => void;
    stageFilter: string | null;
    milestoneFilter: string | null;
    assigneeFilter: string | null;
    mineFilter: boolean;
    qFilter: string;
    profiles: Profile[];
    milestones: Milestone[];
    hasActiveFilters: boolean;
    activeFilterCount: number;
    filteredCount: number;
    totalCount: number;
    onUpdateQuery: (updates: Record<string, string | null>) => void;
    onClearFilters: () => void;
};
function PmBoardFilters({ searchDraft, setSearchDraft, onSearchCommit, stageFilter, milestoneFilter, assigneeFilter, mineFilter, qFilter, profiles, milestones, hasActiveFilters, activeFilterCount, filteredCount, totalCount, onUpdateQuery, onClearFilters, }: PmBoardFiltersProps) {
    const [open, setOpen] = React.useState(() => hasActiveFilters);
    React.useEffect(() => {
        if (!hasActiveFilters)
            setOpen(false);
    }, [hasActiveFilters]);
    return (<div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setOpen((v) => !v)} className={cn("h-9 gap-2 rounded-full border-slate-200/90 bg-white pl-3 pr-3.5 text-xs font-medium shadow-sm transition-all duration-200", "hover:border-copper/40 hover:bg-copper-soft/30 hover:text-copper-hover", open && "border-copper/45 bg-copper-soft/40 text-copper-hover ring-2 ring-copper/15")}>
          <SlidersHorizontal className="h-3.5 w-3.5"/>
          {open ? "Hide filters" : "Refine board"}
          {activeFilterCount > 0 ? (<span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-copper px-1.5 text-[10px] font-semibold text-white">
              {activeFilterCount}
            </span>) : null}
        </Button>

        {hasActiveFilters && !open ? (<p className="text-xs text-slate-500">
            Showing{" "}
            <span className="font-medium text-slate-700">{filteredCount}</span> of{" "}
            {totalCount}
            {qFilter.trim() ? (<>
                {" "}
                matching &ldquo;{qFilter.trim()}&rdquo;
              </>) : null}
          </p>) : null}

        {hasActiveFilters ? (<Button type="button" variant="ghost" size="sm" className="h-9 rounded-full text-xs text-slate-500 hover:text-slate-900" onClick={onClearFilters}>
            Clear all
          </Button>) : null}
      </div>

      <div className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <div className="space-y-4 rounded-xl border border-slate-200/90 bg-linear-to-b from-white to-slate-50/80 p-4 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-copper">
                  Board tools
                </p>
                <p className="mt-0.5 text-sm text-slate-600">
                  Narrow the board without leaving your flow.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setOpen(false)} aria-label="Close filters">
                <X className="h-4 w-4"/>
              </Button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
              <Input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter")
                onSearchCommit();
        }} placeholder="Search tasks by title or description…" className="h-10 rounded-lg border-slate-200/90 bg-white pl-9 shadow-sm focus-visible:ring-copper/30"/>
              {searchDraft.trim() && searchDraft.trim() !== qFilter.trim() ? (<Button type="button" size="sm" className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 rounded-md bg-copper px-2.5 text-[11px] font-medium text-white hover:bg-copper-hover" onClick={onSearchCommit}>
                  Apply
                </Button>) : null}
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Scope
                </p>
                <div className="flex flex-wrap gap-2">
                  <FilterChip active={mineFilter} onClick={() => onUpdateQuery({
            mine: mineFilter ? null : "1",
            assignee: null,
        })}>
                    My tasks only
                  </FilterChip>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Assignee
                </p>
                <div className="flex flex-wrap gap-2">
                  <FilterChip active={!assigneeFilter && !mineFilter} onClick={() => onUpdateQuery({ assignee: null, mine: null })}>
                    Everyone
                  </FilterChip>
                  {profiles.map((p) => (<FilterChip key={p.id} active={assigneeFilter === p.id} onClick={() => onUpdateQuery({
                assignee: assigneeFilter === p.id ? null : p.id,
                mine: null,
            })}>
                      {p.full_name || "Member"}
                    </FilterChip>))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Milestone
                </p>
                <div className="flex flex-wrap gap-2">
                  <FilterChip active={!milestoneFilter} onClick={() => onUpdateQuery({ milestone: null })}>
                    All milestones
                  </FilterChip>
                  {milestones.map((m) => (<FilterChip key={m.id} active={milestoneFilter === m.id} onClick={() => onUpdateQuery({
                milestone: milestoneFilter === m.id ? null : m.id,
            })}>
                      {m.title}
                    </FilterChip>))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Stage
                </p>
                <div className="flex flex-wrap gap-2">
                  <FilterChip active={!stageFilter} onClick={() => onUpdateQuery({ stage: null })}>
                    All stages
                  </FilterChip>
                  {BOARD_STAGES.map((s) => (<FilterChip key={s} active={stageFilter === s} onClick={() => onUpdateQuery({
                stage: stageFilter === s ? null : s,
            })}>
                      {BOARD_COLUMN_META[s].title}
                    </FilterChip>))}
                </div>
              </div>
            </div>

            {hasActiveFilters ? (<p className="border-t border-slate-200/80 pt-3 text-xs text-slate-500">
                Showing{" "}
                <span className="font-medium text-slate-700">{filteredCount}</span> of{" "}
                {totalCount} tasks
                {qFilter.trim() ? (<>
                    {" "}
                    matching &ldquo;{qFilter.trim()}&rdquo;
                  </>) : null}
                .
              </p>) : null}
          </div>
        </div>
      </div>
    </div>);
}
export type KanbanBoardProps = {
    projectId: string;
    initialTasks: TaskWithRelations[];
    initialAttachments?: TaskAttachment[];
    viewerRole: UserRole;
    viewerId: string;
    isArchived?: boolean;
};
export function KanbanBoard({ projectId, initialTasks, initialAttachments = [], viewerRole, viewerId, isArchived = false, }: KanbanBoardProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [tasks, setTasks] = React.useState<TaskWithRelations[]>(initialTasks);
    const [attachments, setAttachments] = React.useState<TaskAttachment[]>(initialAttachments);
    const [selected, setSelected] = React.useState<TaskWithRelations | null>(null);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [newTitle, setNewTitle] = React.useState("");
    const [adding, setAdding] = React.useState(false);
    const [profiles, setProfiles] = React.useState<Profile[]>([]);
    const [milestones, setMilestones] = React.useState<Milestone[]>([]);
    const [checklistItems, setChecklistItems] = React.useState<ChecklistItem[]>([]);
    const [gateDialog, setGateDialog] = React.useState<{
        task: TaskWithRelations;
        failures: GateFailure[];
    } | null>(null);
    const [handoffBusyId, setHandoffBusyId] = React.useState<string | null>(null);
    const [quickUploadTaskId, setQuickUploadTaskId] = React.useState<string | null>(null);
    const [quickUploading, setQuickUploading] = React.useState(false);
    const quickUploadRef = React.useRef<HTMLInputElement>(null);
    const [searchDraft, setSearchDraft] = React.useState(() => searchParams.get("q") ?? "");
    const stageFilter = searchParams.get("stage");
    const milestoneFilter = searchParams.get("milestone");
    const assigneeFilter = searchParams.get("assignee");
    const mineFilter = searchParams.get("mine") === "1";
    const qFilter = searchParams.get("q") ?? "";
    const isPm = viewerRole === "project_manager";
    const isClient = viewerRole === "client";
    const canFieldEditTask = React.useCallback((t: TaskWithRelations) => {
        if (isClient)
            return false;
        if (isPm)
            return true;
        if (viewerRole === "middleman") {
            return t.assigned_to == null || t.assigned_to === viewerId;
        }
        return false;
    }, [isClient, isPm, viewerId, viewerRole]);
    React.useEffect(() => {
        setTasks(initialTasks);
    }, [initialTasks]);
    React.useEffect(() => {
        setAttachments(initialAttachments);
    }, [initialAttachments]);
    const attachmentsByTask = React.useMemo(() => indexAttachmentsByTask(attachments), [attachments]);
    const setAttachmentsForTask = React.useCallback((taskId: string, items: TaskAttachment[]) => {
        setAttachments((prev) => [
            ...prev.filter((a) => a.task_id !== taskId),
            ...items,
        ]);
    }, []);
    const getTaskAttachments = React.useCallback((taskId: string) => attachmentsByTask.get(taskId) ?? [], [attachmentsByTask]);
    React.useEffect(() => {
        void listMilestones(projectId).then(setMilestones);
        if (isPm) {
            void listProfilesByRoles(["project_manager", "middleman", "client"]).then(setProfiles);
        }
    }, [isPm, projectId]);
    React.useEffect(() => {
        if (!dialogOpen || !isPm)
            return;
        if (profiles.length === 0) {
            void listProfilesByRoles(["project_manager", "middleman", "client"]).then(setProfiles);
        }
        if (milestones.length === 0) {
            void listMilestones(projectId).then(setMilestones);
        }
    }, [dialogOpen, isPm, milestones.length, profiles.length, projectId]);
    const workflowGateContext = React.useMemo((): WorkflowGateContext => ({
        milestones,
        tasks: toGateTasks(tasks),
    }), [milestones, tasks]);
    const updateBoardQuery = React.useCallback((updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === "")
                params.delete(key);
            else
                params.set(key, value);
        }
        const qs = params.toString();
        router.replace(qs ? `${projectBoardPath(projectId)}?${qs}` : projectBoardPath(projectId));
    }, [projectId, router, searchParams]);
    const filteredTasks = React.useMemo(() => {
        let list = tasks;
        if (stageFilter && BOARD_STAGES.includes(stageFilter as BoardColumnStage)) {
            const stage = stageFilter as BoardColumnStage;
            if (stage === "to_do") {
                list = list.filter((t) => t.stage === "to_do" || t.stage === "backlog");
            }
            else {
                list = list.filter((t) => t.stage === stage);
            }
        }
        if (milestoneFilter) {
            list = list.filter((t) => t.milestone_id === milestoneFilter);
        }
        if (mineFilter) {
            list = list.filter((t) => t.assigned_to === viewerId);
        }
        else if (assigneeFilter) {
            list = list.filter((t) => t.assigned_to === assigneeFilter);
        }
        if (qFilter.trim()) {
            const q = qFilter.toLowerCase();
            list = list.filter((t) => t.title.toLowerCase().includes(q) ||
                (t.description?.toLowerCase().includes(q) ?? false));
        }
        return list;
    }, [
        assigneeFilter,
        milestoneFilter,
        mineFilter,
        qFilter,
        stageFilter,
        tasks,
        viewerId,
    ]);
    const hasActiveFilters = Boolean(stageFilter) ||
        Boolean(milestoneFilter) ||
        Boolean(assigneeFilter) ||
        mineFilter ||
        Boolean(qFilter.trim());
    const activeFilterCount = [
        stageFilter,
        milestoneFilter,
        assigneeFilter,
        mineFilter ? "mine" : null,
        qFilter.trim() ? "q" : null,
    ].filter(Boolean).length;
    const clearBoardFilters = React.useCallback(() => {
        setSearchDraft("");
        updateBoardQuery({
            stage: null,
            milestone: null,
            assignee: null,
            mine: null,
            q: null,
        });
    }, [updateBoardQuery]);
    const syncFromServer = React.useCallback(async () => {
        try {
            const next = await listTasksForProject(projectId);
            setTasks(next);
        }
        catch {
            toast.error("Unable to refresh tasks.");
        }
    }, [projectId]);
    const syncAttachments = React.useCallback(async () => {
        try {
            const next = await listTaskAttachmentsForProject(projectId);
            setAttachments(next);
        }
        catch {
            toast.error("Unable to refresh attachments.");
        }
    }, [projectId]);
    const syncFromServerRef = React.useRef(syncFromServer);
    React.useEffect(() => {
        syncFromServerRef.current = syncFromServer;
    }, [syncFromServer]);
    const syncAttachmentsRef = React.useRef(syncAttachments);
    React.useEffect(() => {
        syncAttachmentsRef.current = syncAttachments;
    }, [syncAttachments]);
    React.useEffect(() => {
        const sb = createClient();
        const channelName = `tasks:${projectId}`;
        removeRealtimeChannelByName(sb, channelName);
        const channel = sb.channel(channelName);
        channel
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "tasks",
            filter: `project_id=eq.${projectId}`,
        }, () => {
            void syncFromServerRef.current();
        })
            .subscribe();
        return () => {
            void sb.removeChannel(channel);
        };
    }, [projectId]);
    React.useEffect(() => {
        const sb = createClient();
        const channelName = `task-attachments:${projectId}`;
        removeRealtimeChannelByName(sb, channelName);
        const channel = sb.channel(channelName);
        channel
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "task_attachments",
            filter: `project_id=eq.${projectId}`,
        }, () => {
            void syncAttachmentsRef.current();
        })
            .subscribe();
        return () => {
            void sb.removeChannel(channel);
        };
    }, [projectId]);
    const [collapsed, setCollapsed] = React.useState<Record<BoardColumnStage, boolean>>({
        to_do: false,
        in_progress: false,
        review: false,
        done: false,
    });
    const toggleColumn = React.useCallback((stage: BoardColumnStage) => {
        setCollapsed((prev) => ({ ...prev, [stage]: !prev[stage] }));
    }, []);
    const tasksByStage = React.useMemo(() => {
        const p = partitionBoard(filteredTasks);
        const map = new Map<BoardColumnStage, TaskWithRelations[]>();
        for (const s of BOARD_STAGES) {
            map.set(s, p[s]);
        }
        return map;
    }, [filteredTasks]);
    const health = React.useMemo(() => boardHealthStats(tasks), [tasks]);
    function guardArchived(): boolean {
        if (!isArchived)
            return false;
        toast.error("This engagement is formally closed and read-only.");
        return true;
    }
    async function handleQuickAssign(taskId: string, assigneeId: string | null) {
        if (!isPm || guardArchived())
            return;
        const tasksBefore = toTaskNotifySnapshots(tasks);
        try {
            await updateTask({ id: taskId, assigned_to: assigneeId });
            await notifyWorkReadyAfterProjectTaskChange(projectId, tasksBefore);
            await logActivity({
                project_id: projectId,
                action_type: "task_updated",
                details: { task_id: taskId },
            });
            toast.success("Assignee updated");
            await syncFromServer();
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Assign failed.");
        }
    }
    function triggerQuickUpload(taskId: string) {
        setQuickUploadTaskId(taskId);
        quickUploadRef.current?.click();
    }
    async function handleQuickUpload(files: FileList | null) {
        if (!files?.length || !quickUploadTaskId)
            return;
        const task = tasks.find((t) => t.id === quickUploadTaskId);
        if (!task || (!canFieldEditTask(task) && !isPm))
            return;
        setQuickUploading(true);
        const added: TaskAttachment[] = [];
        try {
            for (const file of Array.from(files)) {
                const attachment = await uploadTaskAttachment(projectId, quickUploadTaskId, file);
                added.push(attachment);
            }
            setAttachmentsForTask(quickUploadTaskId, [
                ...getTaskAttachments(quickUploadTaskId),
                ...added,
            ]);
            toast.success(added.length === 1 ? "Attachment uploaded" : `${added.length} files uploaded`);
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Upload failed.");
        }
        finally {
            setQuickUploading(false);
            setQuickUploadTaskId(null);
            if (quickUploadRef.current)
                quickUploadRef.current.value = "";
        }
    }
    async function persistBoardMove(taskId: string, sourceStage: BoardColumnStage, destStage: BoardColumnStage, destIndex: number, claimAssigneeId?: string) {
        if (guardArchived())
            return;
        const task = tasks.find((t) => t.id === taskId);
        if (!task)
            return;
        const m = partitionBoard(tasks);
        const src = [...m[sourceStage]];
        const fromIdx = src.findIndex((t) => t.id === taskId);
        if (fromIdx < 0)
            return;
        const [moved] = src.splice(fromIdx, 1);
        m[sourceStage] = src;
        const movedTask: TaskWithRelations = {
            ...moved,
            stage: destStage,
            ...(claimAssigneeId ? { assigned_to: claimAssigneeId } : {}),
        };
        if (sourceStage === destStage) {
            m[sourceStage].splice(destIndex, 0, movedTask);
        }
        else {
            const dst = [...m[destStage]];
            dst.splice(destIndex, 0, movedTask);
            m[destStage] = dst;
        }
        const next: TaskWithRelations[] = [
            ...m.to_do.map((t, i) => ({ ...t, stage: "to_do" as TaskStage, position: i })),
            ...m.in_progress.map((t, i) => ({
                ...t,
                stage: "in_progress" as TaskStage,
                position: i,
            })),
            ...m.review.map((t, i) => ({ ...t, stage: "review" as TaskStage, position: i })),
            ...m.done.map((t, i) => ({ ...t, stage: "done" as TaskStage, position: i })),
        ];
        const before = tasks;
        setTasks(next);
        const changed = next.filter((n) => {
            const o = before.find((b) => b.id === n.id);
            return (o &&
                (o.stage !== n.stage ||
                    o.position !== n.position ||
                    o.assigned_to !== n.assigned_to));
        });
        const tasksBefore = toTaskNotifySnapshots(before);
        try {
            const clientVisibleAt = destStage === "done" && sourceStage !== "done"
                ? new Date().toISOString()
                : undefined;
            for (const u of changed) {
                await updateTask({
                    id: u.id,
                    stage: u.stage,
                    position: u.position,
                    ...(u.id === taskId && claimAssigneeId
                        ? { assigned_to: claimAssigneeId }
                        : {}),
                    ...(u.id === taskId && clientVisibleAt
                        ? { client_visible_at: clientVisibleAt }
                        : {}),
                });
            }
            if (clientVisibleAt && taskId) {
                await approveTaskAttachmentsForClient(taskId, clientVisibleAt);
            }
            if (sourceStage !== destStage) {
                await logActivity({
                    project_id: projectId,
                    action_type: "task_moved",
                    details: {
                        task_id: taskId,
                        title: task.title,
                        from: sourceStage,
                        to: destStage,
                        handoff: true,
                    },
                });
                const destMeta = BOARD_COLUMN_META[destStage];
                toast.success(`Handed off to ${destMeta.title}`);
                const sync = await syncMilestoneFromLinkedTasks(projectId, task.milestone_id);
                if (sync.completed && sync.title) {
                    toast.success(`“${sync.title}” delivered — all linked tasks accepted`);
                    void listMilestones(projectId).then(setMilestones);
                }
                else if (sync.reopened && sync.title) {
                    void listMilestones(projectId).then(setMilestones);
                }
                if (destStage === "done") {
                    await dismissWorkNotificationsForTask(taskId);
                }
            }
            const assigneeChanged = changed.some((u) => u.assigned_to !== before.find((b) => b.id === u.id)?.assigned_to);
            if (sourceStage !== destStage || assigneeChanged) {
                await notifyWorkReadyAfterProjectTaskChange(projectId, tasksBefore);
            }
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not move task.");
            void syncFromServer();
        }
    }
    async function handleHandoff(task: TaskWithRelations, targetStage: BoardColumnStage) {
        if (guardArchived())
            return;
        if (!canFieldEditTask(task) && !isPm)
            return;
        const sourceStage = normalizeBoardStage(task.stage);
        if (sourceStage === targetStage)
            return;
        const validation = validateStageTransition(task, sourceStage, targetStage, viewerRole, workflowGateContext);
        if (!validation.ok) {
            setGateDialog({ task, failures: validation.failures });
            return;
        }
        const claimAssigneeId = validation.claimAssignee === "self" ? viewerId : undefined;
        const destIndex = partitionBoard(tasks)[targetStage].length;
        setHandoffBusyId(task.id);
        try {
            await persistBoardMove(task.id, sourceStage, targetStage, destIndex, claimAssigneeId);
        }
        finally {
            setHandoffBusyId(null);
        }
    }
    async function handleDragEnd(result: DropResult) {
        const { destination, source, draggableId } = result;
        if (!destination)
            return;
        if (destination.droppableId === source.droppableId &&
            destination.index === source.index) {
            return;
        }
        const sourceStage = source.droppableId as BoardColumnStage;
        const destStage = destination.droppableId as BoardColumnStage;
        const task = tasks.find((t) => t.id === draggableId);
        if (!task)
            return;
        if (!canFieldEditTask(task)) {
            toast.error("You can only move unassigned tasks or tasks assigned to you.");
            return;
        }
        let claimAssigneeId: string | undefined;
        if (sourceStage !== destStage) {
            const validation = validateStageTransition(task, sourceStage, destStage, viewerRole, workflowGateContext);
            if (!validation.ok) {
                setGateDialog({ task, failures: validation.failures });
                return;
            }
            if (validation.claimAssignee === "self") {
                claimAssigneeId = viewerId;
            }
        }
        await persistBoardMove(draggableId, sourceStage, destStage, destination.index, claimAssigneeId);
    }
    async function handleAddTask(e: React.FormEvent) {
        e.preventDefault();
        if (!newTitle.trim() || !isPm || guardArchived())
            return;
        setAdding(true);
        try {
            const created = await createTask({
                project_id: projectId,
                title: newTitle.trim(),
                stage: "to_do",
            });
            await logActivity({
                project_id: projectId,
                action_type: "task_created",
                details: { task_id: created.id, title: created.title },
            });
            setNewTitle("");
            toast.success("Task created");
            await syncFromServer();
            router.refresh();
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Unable to create task.");
        }
        finally {
            setAdding(false);
        }
    }
    function openTask(t: TaskWithRelations) {
        setSelected(t);
        setChecklistItems(parseChecklist(t.checklist));
        setDialogOpen(true);
    }
    async function handleSaveTask(form: FormData) {
        if (!selected || isClient)
            return;
        if (!canFieldEditTask(selected) && !isPm)
            return;
        setSaving(true);
        try {
            const title = String(form.get("title") ?? "").trim();
            const description = String(form.get("description") ?? "").trim() || null;
            const priority = String(form.get("priority") ?? "medium") as TaskPriority;
            const due = String(form.get("due_date") ?? "").trim() || null;
            await updateTask({
                id: selected.id,
                title,
                description,
                priority,
                due_date: due,
                checklist: checklistItems,
                ...(isPm
                    ? {
                        assigned_to: String(form.get("assigned_to") ?? "").trim() || null,
                        milestone_id: String(form.get("milestone_id") ?? "").trim() || null,
                    }
                    : {}),
            });
            await logActivity({
                project_id: projectId,
                action_type: "task_updated",
                details: { task_id: selected.id, title },
            });
            toast.success("Task saved");
            setDialogOpen(false);
            await syncFromServer();
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Save failed.");
        }
        finally {
            setSaving(false);
        }
    }
    async function handleDeleteTask() {
        if (!selected || !isPm)
            return;
        setSaving(true);
        try {
            await deleteTask(selected.id);
            toast.success("Task removed");
            setDialogOpen(false);
            await syncFromServer();
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed.");
        }
        finally {
            setSaving(false);
        }
    }
    return (<div className="space-y-4">
      <input ref={quickUploadRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" multiple className="hidden" onChange={(e) => void handleQuickUpload(e.target.files)}/>

      {isPm ? (<form onSubmit={handleAddTask} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label htmlFor="new-task" className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
              New task
            </Label>
            <Input id="new-task" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Site measure, RCP set, client sign-off…" className="h-10 rounded-lg border-slate-200 bg-slate-50/50 focus-visible:bg-white"/>
          </div>
          <Button type="submit" disabled={adding || !newTitle.trim()} className="h-10 gap-1.5 rounded-lg border border-copper/30 bg-copper px-4 text-xs font-medium text-white hover:bg-copper-hover">
            {adding ? (<Loader2 className="h-4 w-4 animate-spin"/>) : (<>
                <Plus className="h-4 w-4"/>
                Add
              </>)}
          </Button>
        </form>) : null}

      {isPm ? (<PmBoardFilters searchDraft={searchDraft} setSearchDraft={setSearchDraft} onSearchCommit={() => updateBoardQuery({ q: searchDraft.trim() || null })} stageFilter={stageFilter} milestoneFilter={milestoneFilter} assigneeFilter={assigneeFilter} mineFilter={mineFilter} qFilter={qFilter} profiles={profiles} milestones={milestones} hasActiveFilters={hasActiveFilters} activeFilterCount={activeFilterCount} filteredCount={filteredTasks.length} totalCount={tasks.length} onUpdateQuery={updateBoardQuery} onClearFilters={clearBoardFilters}/>) : viewerRole === "middleman" ? (<div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="min-w-[160px] flex-1 space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Search
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"/>
              <Input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} onKeyDown={(e) => {
                if (e.key === "Enter") {
                    updateBoardQuery({ q: searchDraft.trim() || null });
                }
            }} placeholder="Search tasks…" className="h-9 rounded-lg pl-8"/>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={mineFilter} onClick={() => updateBoardQuery({ mine: mineFilter ? null : "1", assignee: null })}>
              My tasks
            </FilterChip>
            {milestones.slice(0, 4).map((m) => (<FilterChip key={m.id} active={milestoneFilter === m.id} onClick={() => updateBoardQuery({
                    milestone: milestoneFilter === m.id ? null : m.id,
                })}>
                {m.title}
              </FilterChip>))}
          </div>
          {hasActiveFilters ? (<Button type="button" variant="ghost" className="h-9 rounded-full text-xs text-slate-600" onClick={clearBoardFilters}>
              Clear
            </Button>) : null}
        </div>) : null}

      {hasActiveFilters && !isPm ? (<p className="text-xs text-slate-500">
          Showing {filteredTasks.length} of {tasks.length} tasks
          {qFilter ? ` matching “${qFilter}”` : ""}.
        </p>) : null}

      {!isClient ? (<div className="space-y-3">
          <BoardWorkflowBar readyUnowned={health.readyUnowned} activeInProgress={health.activeInProgress} awaitingPm={health.awaitingPm} accepted={health.accepted} total={tasks.length} isPm={isPm}/>
          <p className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs leading-relaxed text-slate-500">
            <span className="font-medium text-slate-700">Handoff pipeline</span> — work
            moves one stage at a time. Linked tasks follow milestone order: finish earlier
            phases before starting the next. Assign an owner to start, and only the PM can
            sign off into Accepted.
          </p>
        </div>) : null}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
          {BOARD_STAGES.map((stage, stageIndex) => {
            const columnTasks = tasksByStage.get(stage) ?? [];
            const isCollapsed = collapsed[stage];
            const wipOver = stage === "review" && columnTasks.length > REVIEW_WIP_SOFT_LIMIT;
            const meta = BOARD_COLUMN_META[stage];
            const shell = COLUMN_SHELL[stage];
            return (<React.Fragment key={stage}>
                {stageIndex > 0 ? (<div className="hidden shrink-0 flex-col items-center justify-center px-0.5 sm:flex" aria-hidden>
                    <div className="h-px w-4 bg-cool-grey"/>
                    {stage === "done" && !isPm ? (<Lock className="my-1 h-3 w-3 text-copper/70"/>) : (<ChevronRight className="my-0.5 h-3.5 w-3.5 text-copper/60"/>)}
                  </div>) : null}
              <div className={cn("flex shrink-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-[width] duration-200 ease-out", shell.shell, isCollapsed ? "w-18" : "w-[292px]")}>
                <div className={cn("flex border-b border-slate-100/80", shell.header, isCollapsed
                    ? "flex-col items-center gap-2 px-1 py-2"
                    : "items-center justify-between gap-2 px-3 py-2.5")}>
                  {isCollapsed ? (<>
                      <button type="button" onClick={() => toggleColumn(stage)} className="rounded-sm p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900" aria-expanded={!isCollapsed} aria-controls={`kanban-col-${stage}`} title={`Expand ${TASK_STAGE_LABELS[stage]}`} aria-label={`Expand ${TASK_STAGE_LABELS[stage]} column`}>
                        <ChevronRight className="h-4 w-4"/>
                      </button>
                      <span className={cn("font-mono text-[9px] font-semibold uppercase tracking-widest", shell.abbr)} title={TASK_STAGE_LABELS[stage]}>
                        {STAGE_ABBR[stage]}
                      </span>
                      <span className="font-heading text-sm tabular-nums text-slate-900">
                        {columnTasks.length}
                      </span>
                    </>) : (<>
                      <div className="min-w-0">
                        <span className={cn("block truncate text-xs font-semibold", shell.title)}>
                          {meta.title}
                        </span>
                        <span className={cn("block truncate text-[10px]", shell.hint)}>
                          {meta.hint}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={cn("rounded-md bg-white/80 px-2 py-0.5 font-heading text-xs tabular-nums text-slate-800 ring-1 ring-slate-200/60", wipOver && "bg-amber-50 text-amber-900 ring-amber-200/80")} title={wipOver
                        ? `Review column has ${columnTasks.length} items — consider clearing the queue`
                        : undefined}>
                          {columnTasks.length}
                          {wipOver ? " · high" : ""}
                        </span>
                        <button type="button" onClick={() => toggleColumn(stage)} className="rounded-sm p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900" aria-expanded={!isCollapsed} aria-controls={`kanban-col-${stage}`} title={`Collapse ${TASK_STAGE_LABELS[stage]}`} aria-label={`Collapse ${TASK_STAGE_LABELS[stage]} column`}>
                          <ChevronDown className="h-4 w-4"/>
                        </button>
                      </div>
                    </>)}
                </div>
                <Droppable droppableId={stage} isDropDisabled={isCollapsed && columnTasks.length > 0}>
                  {(dropProvided, snapshot) => (<div id={`kanban-col-${stage}`} ref={dropProvided.innerRef} {...dropProvided.droppableProps} className={cn("flex flex-1 flex-col gap-2 transition-colors", isCollapsed ? "min-h-[260px] p-1.5" : "min-h-[320px] p-2", shell.body, snapshot.isDraggingOver ? shell.drop : null)}>
                      {!isCollapsed ? (columnTasks.map((task, index) => {
                        const blocked = taskBlockedReason(task, viewerRole, workflowGateContext);
                        const progress = checklistProgress(task.checklist);
                        const handoff = nextHandoffAction(task, viewerRole, viewerId, workflowGateContext);
                        const taskStage = normalizeBoardStage(task.stage);
                        const taskAttachments = getTaskAttachments(task.id);
                        const canAttach = !isClient && (canFieldEditTask(task) || isPm);
                        const needsOwner = isPm && !task.assigned_to && taskStage !== "done";
                        return (<Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!canFieldEditTask(task)}>
                            {(dragProvided, dragSnapshot) => (<div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className={cn("group relative w-full rounded-lg border border-slate-200/90 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md", needsOwner &&
                                    !isOverdue(task.due_date, task.stage) &&
                                    "border-amber-200/70 border-l-[3px] border-l-amber-400/60 bg-amber-50/35 hover:border-amber-300/75 hover:bg-amber-50/50", isOverdue(task.due_date, task.stage) &&
                                    "border-red-300 ring-1 ring-red-200/80", taskStage === "done" &&
                                    "border-emerald-200/80 bg-emerald-50/40", taskStage === "review" &&
                                    !needsOwner &&
                                    "border-copper/25 bg-white", dragSnapshot.isDragging &&
                                    "rotate-[0.5deg] shadow-lg ring-1 ring-copper/30")}>
                                <div className="flex items-start gap-1 p-2">
                                  {!isClient ? (<button type="button" {...dragProvided.dragHandleProps} className={cn("mt-0.5 shrink-0 rounded-sm p-0.5 text-slate-300 outline-none hover:bg-slate-100 hover:text-slate-500", !canFieldEditTask(task) &&
                                        "pointer-events-none opacity-30")} aria-label="Drag to next pipeline stage">
                                      <GripVertical className="h-4 w-4"/>
                                    </button>) : null}
                                  <div className="min-w-0 flex-1 space-y-2">
                                    <button type="button" onClick={() => openTask(task)} className="w-full space-y-2 p-1 text-left">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <p className="font-medium leading-snug text-slate-900">
                                          {task.title}
                                        </p>
                                        {blocked ? (<span className="shrink-0 rounded-sm border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-amber-900">
                                            {blocked}
                                          </span>) : needsOwner ? (<span className="shrink-0 rounded-md bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200/60">
                                            Needs owner
                                          </span>) : null}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <Badge variant="outline" className={cn("rounded-none px-1.5 py-0 text-[10px] font-normal uppercase tracking-wide", task.priority === "high" &&
                                    "border-red-200 bg-red-50 text-red-800", task.priority === "medium" &&
                                    "border-amber-200 bg-amber-50 text-amber-900", task.priority === "low" &&
                                    "border-slate-200 bg-slate-50 text-slate-600")}>
                                        {PRIORITY_LABEL[task.priority]}
                                      </Badge>
                                      <TaskAttachmentIndicator attachments={taskAttachments}/>
                                      {task.due_date ? (<span className={cn("inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide", isOverdue(task.due_date, task.stage)
                                        ? "text-red-600"
                                        : "text-slate-500")}>
                                            <Calendar className="h-3 w-3"/>
                                            {task.due_date}
                                          </span>) : null}
                                      </div>
                                      {progress.total > 0 ? (<div className="space-y-1">
                                          <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wide text-slate-500">
                                            <span>Deliverables</span>
                                            <span className="tabular-nums">
                                              {progress.done}/{progress.total}
                                            </span>
                                          </div>
                                          <div className="h-1 overflow-hidden bg-slate-100">
                                            <div className={cn("h-full transition-all", progress.complete
                                        ? "bg-emerald-500"
                                        : "bg-copper")} style={{
                                        width: `${(progress.done / progress.total) * 100}%`,
                                    }}/>
                                          </div>
                                        </div>) : taskStage === "in_progress" ? (<p className="text-[10px] text-amber-700">
                                          Add deliverables in task details
                                        </p>) : null}
                                      <div className="flex items-center justify-between gap-2 pt-0.5">
                                        {isPm ? (<select value={task.assigned_to ?? ""} onClick={(e) => e.stopPropagation()} onChange={(e) => {
                                        e.stopPropagation();
                                        void handleQuickAssign(task.id, e.target.value || null);
                                    }} className={cn("max-w-[120px] truncate rounded-md border px-1.5 py-0.5 text-[10px]", !task.assigned_to
                                        ? "border-amber-300/70 bg-amber-50/90 font-medium text-amber-900"
                                        : "border-slate-100 bg-slate-50 text-slate-600")} aria-label="Quick assign">
                                            <option value="">Unassigned</option>
                                            {profiles.map((p) => (<option key={p.id} value={p.id}>
                                                {p.full_name}
                                              </option>))}
                                          </select>) : task.assignee ? (<div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6 rounded-sm border border-slate-200">
                                              {task.assignee.avatar_url ? (<AvatarImage src={task.assignee.avatar_url} alt=""/>) : null}
                                              <AvatarFallback className="rounded-sm bg-slate-800 text-[9px] text-white">
                                                {initials(task.assignee.full_name)}
                                              </AvatarFallback>
                                            </Avatar>
                                            <span className="truncate text-xs text-slate-600">
                                              {task.assignee.full_name}
                                            </span>
                                          </div>) : (<span className="text-xs text-slate-400">Unassigned</span>)}
                                        {task.milestone ? (<span className="max-w-28 truncate rounded-none border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500" title={task.milestone.title}>
                                            {task.milestone.title}
                                          </span>) : null}
                                      </div>
                                    </button>

                                    {!isClient && (handoff || canAttach || (isPm && taskStage === "review")) ? (<div className="flex flex-wrap gap-1.5 px-1 pb-1">
                                        {canAttach ? (<button type="button" disabled={quickUploading &&
                                            quickUploadTaskId === task.id} onClick={() => triggerQuickUpload(task.id)} className="inline-flex items-center gap-1 rounded-sm border border-slate-200 bg-white px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600 hover:border-copper/30 hover:bg-copper-soft/40 disabled:opacity-50">
                                            {quickUploading &&
                                            quickUploadTaskId === task.id ? (<Loader2 className="h-3 w-3 animate-spin"/>) : (<Paperclip className="h-3 w-3"/>)}
                                            Attach
                                          </button>) : null}
                                        {handoff ? (<button type="button" disabled={handoffBusyId === task.id} onClick={() => void handleHandoff(task, handoff.targetStage)} className={cn("inline-flex items-center gap-1 rounded-sm border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors disabled:opacity-50", handoff.variant === "approve"
                                            ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                                            : handoff.variant === "submit"
                                                ? "border-copper/40 bg-copper-soft text-copper-hover hover:bg-copper-soft/80"
                                                : "border-navy/20 bg-navy text-white hover:bg-navy-soft")}>
                                            {handoffBusyId === task.id ? (<Loader2 className="h-3 w-3 animate-spin"/>) : null}
                                            {handoff.label}
                                          </button>) : null}
                                        {isPm && taskStage === "review" ? (<button type="button" disabled={handoffBusyId === task.id} onClick={() => void handleHandoff(task, "in_progress")} className="rounded-sm border border-slate-200 bg-white px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                                            Send back
                                          </button>) : null}
                                      </div>) : null}
                                  </div>
                                </div>
                              </div>)}
                          </Draggable>);
                    })) : columnTasks.length > 0 ? (<div className="flex flex-1 flex-col items-center justify-center gap-2 px-1 py-4 text-center">
                          <p className="font-heading text-2xl tabular-nums text-slate-800">
                            {columnTasks.length}
                          </p>
                          <p className="text-[10px] leading-snug text-slate-500">
                            Expand to view, move, or receive tasks.
                          </p>
                        </div>) : (<div className="flex flex-1 items-center justify-center p-2 text-center text-[10px] text-slate-400">
                          Hand off work here
                        </div>)}
                      {dropProvided.placeholder}
                    </div>)}
                </Droppable>
              </div>
              </React.Fragment>);
        })}
        </div>
      </DragDropContext>

      <Dialog open={gateDialog !== null} onOpenChange={(open) => {
            if (!open)
                setGateDialog(null);
        }}>
        <DialogContent className="rounded-none border-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Handoff blocked</DialogTitle>
            <DialogDescription>
              {gateDialog?.task.title
            ? `“${gateDialog.task.title}” cannot advance yet.`
            : "This task cannot advance yet."}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-slate-700">
            {gateDialog?.failures.map((f) => (<li key={f.code} className="flex gap-2 rounded-sm border border-amber-200/80 bg-amber-50/80 px-3 py-2">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-800"/>
                {f.message}
              </li>))}
          </ul>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-none" onClick={() => setGateDialog(null)}>
              Close
            </Button>
            {gateDialog &&
            gateDialog.failures.some((f) => f.code === "checklist") ? (<Button type="button" className="rounded-none bg-[#d97706] text-slate-950 hover:bg-[#ef9b27]" onClick={() => {
                openTask(gateDialog.task);
                setGateDialog(null);
            }}>
                Open task details
              </Button>) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] max-w-lg overflow-y-auto rounded-none border-slate-200 sm:max-w-lg" showCloseButton>
          {selected ? (<>
              <DialogHeader>
                <DialogTitle className="font-heading text-lg tracking-tight">
                  Task
                </DialogTitle>
                <DialogDescription>
                  {isClient
                ? "Read-only view. Contact your project manager to request changes."
                : "Details, ownership, and scheduling for this work item."}
                </DialogDescription>
              </DialogHeader>

              {isClient ? (<div className="space-y-3 text-sm">
                  <p className="font-medium text-slate-900">{selected.title}</p>
                  {selected.description ? (<p className="whitespace-pre-wrap text-slate-600">{selected.description}</p>) : null}
                  <ChecklistEditor items={parseChecklist(selected.checklist)} onChange={() => { }} disabled/>
                  <TaskAttachmentPanel projectId={projectId} taskId={selected.id} attachments={getTaskAttachments(selected.id)} onChange={(items) => setAttachmentsForTask(selected.id, items)} canUpload={false} canDelete={false}/>
                </div>) : (<form className="space-y-4" onSubmit={(e) => {
                    e.preventDefault();
                    void handleSaveTask(new FormData(e.currentTarget));
                }}>
                  <div className="space-y-1.5">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" name="title" key={selected.id} defaultValue={selected.title} required disabled={!canFieldEditTask(selected) && !isPm} className="rounded-none"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <textarea id="description" name="description" defaultValue={selected.description ?? ""} rows={4} disabled={!canFieldEditTask(selected) && !isPm} className="w-full border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"/>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Priority</Label>
                      <select name="priority" defaultValue={selected.priority} disabled={!canFieldEditTask(selected) && !isPm} className="h-10 w-full border border-input bg-background px-3 text-sm">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="due_date">Due date</Label>
                      <Input id="due_date" name="due_date" type="date" defaultValue={selected.due_date ?? ""} disabled={!canFieldEditTask(selected) && !isPm} className="rounded-none"/>
                    </div>
                  </div>
                  {isPm ? (<>
                      <div className="space-y-1.5">
                        <Label>Assignee</Label>
                        <select name="assigned_to" defaultValue={selected.assigned_to ?? ""} className="h-10 w-full border border-input bg-background px-3 text-sm">
                          <option value="">Unassigned</option>
                          {profiles.map((p) => (<option key={p.id} value={p.id}>
                              {p.full_name}
                            </option>))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Milestone</Label>
                        <select name="milestone_id" defaultValue={selected.milestone_id ?? ""} className="h-10 w-full border border-input bg-background px-3 text-sm">
                          <option value="">None</option>
                          {milestones.map((m) => (<option key={m.id} value={m.id}>
                              {m.title}
                            </option>))}
                        </select>
                      </div>
                    </>) : null}

                  <ChecklistEditor items={checklistItems} onChange={setChecklistItems} disabled={!canFieldEditTask(selected) && !isPm}/>

                  <TaskAttachmentPanel projectId={projectId} taskId={selected.id} attachments={getTaskAttachments(selected.id)} onChange={(items) => setAttachmentsForTask(selected.id, items)} canUpload={canFieldEditTask(selected) || isPm} canDelete={isPm || selected.assigned_to === viewerId}/>

                  <DialogFooter className="flex flex-row flex-wrap gap-2 border-0 bg-transparent p-0 sm:justify-between">
                    {isPm ? (<Button type="button" variant="outline" className="rounded-none border-red-200 text-red-700 hover:bg-red-50" onClick={() => void handleDeleteTask()} disabled={saving}>
                        <Trash2 className="h-4 w-4"/>
                        Delete
                      </Button>) : (<span />)}
                    <Button type="submit" disabled={saving || (!canFieldEditTask(selected) && !isPm)} className="rounded-none bg-[#d97706] font-mono text-[11px] uppercase tracking-[0.14em] text-slate-950 hover:bg-[#ef9b27]">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : "Save changes"}
                    </Button>
                  </DialogFooter>
                </form>)}
            </>) : null}
        </DialogContent>
      </Dialog>
    </div>);
}
