import { notFound } from "next/navigation";
import { CalendarRange, HardHat, UserRound } from "lucide-react";
import { OverviewTaskSummary } from "@/components/projects/overview-task-summary";
import { ProjectClosurePanel } from "@/components/projects/project-closure-panel";
import { RoleBadge } from "@/components/shared/role-badge";
import { isProjectArchived } from "@/lib/project-lifecycle";
import { formatDisplayDate } from "@/lib/milestone-utils";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/services/project-service";
import type { Profile, Task } from "@/types/database";
import type { UserRole } from "@/types/enums";
import { MilestoneEditor } from "./_overview/milestone-editor";
const MILESTONE_EDIT_ROLES: UserRole[] = ["project_manager"];
export default async function ProjectOverviewPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    const { data: viewerProfile } = user
        ? await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle()
        : { data: null };
    const viewerRole = (viewerProfile as Pick<Profile, "role"> | null)?.role ?? null;
    const canEditMilestones = viewerRole != null &&
        MILESTONE_EDIT_ROLES.includes(viewerRole);
    const isClient = viewerRole === "client";
    const isPm = viewerRole === "project_manager";
    const project = await getProjectById(id, supabase, { withMilestones: true });
    if (!project)
        notFound();
    const isArchived = isProjectArchived(project);
    const canEdit = canEditMilestones && !isArchived;
    const { data: memberRows } = await supabase
        .from("project_members")
        .select("user_id, role_in_project")
        .eq("project_id", id);
    let members: Array<{
        user_id: string;
        role_in_project: string;
        profiles: Profile | null;
    }> = [];
    if (memberRows && memberRows.length > 0) {
        const userIds = memberRows.map((m) => m.user_id);
        const { data: memberProfiles } = await supabase
            .from("profiles")
            .select("id, full_name, role, avatar_url")
            .in("id", userIds);
        const profileMap = new Map((memberProfiles ?? []).map((p) => [p.id, p]));
        members = memberRows.map((m) => ({
            ...m,
            profiles: (profileMap.get(m.user_id) as Profile | undefined) ?? null,
        }));
    }
    const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", id)
        .order("position", { ascending: true });
    const taskList = (tasks ?? []) as Task[];
    const milestones = project.milestones ?? [];
    const taskProgressByMilestone: Record<string, {
        total: number;
        done: number;
    }> = {};
    for (const t of taskList) {
        if (!t.milestone_id)
            continue;
        const bucket = taskProgressByMilestone[t.milestone_id] ?? {
            total: 0,
            done: 0,
        };
        bucket.total += 1;
        if (t.stage === "done")
            bucket.done += 1;
        taskProgressByMilestone[t.milestone_id] = bucket;
    }
    const tasksByStage = {
        to_do: taskList.filter((t) => t.stage === "backlog" || t.stage === "to_do"),
        in_progress: taskList.filter((t) => t.stage === "in_progress"),
        review: taskList.filter((t) => t.stage === "review"),
        done: taskList.filter((t) => t.stage === "done"),
    };
    const deliverableCount = isClient
        ? taskList.filter((t) => t.client_visible_at != null).length
        : 0;
    const milestoneCompleted = milestones.filter((m) => m.completed).length;
    return (<div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <MilestoneEditor projectId={id} initialMilestones={milestones} canEdit={canEdit} viewerRole={viewerRole} projectStart={project.start_date} projectEnd={project.end_date} taskProgressByMilestone={taskProgressByMilestone} isArchived={isArchived}/>

        <OverviewTaskSummary projectId={id} counts={{
            to_do: tasksByStage.to_do.length,
            in_progress: tasksByStage.in_progress.length,
            review: tasksByStage.review.length,
            done: tasksByStage.done.length,
        }} totalTasks={taskList.length} viewerRole={viewerRole} milestoneTotal={milestones.length} milestoneCompleted={milestoneCompleted} deliverableCount={deliverableCount}/>

        {isPm || isArchived ? (<ProjectClosurePanel project={project} milestones={milestones} tasks={taskList} canManage={isPm} completedByUserId={user?.id ?? project.pm_id} closedByName={project.pm?.full_name}/>) : null}
      </div>

      <div className="space-y-6">
        <section className={isClient
            ? "border border-stone-200/90 bg-white p-5"
            : "border border-slate-200 bg-white p-5"}>
          <h3 className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Project Info
          </h3>
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <HardHat className="h-4 w-4 text-slate-400"/>
              <div>
                <div className="text-[10px] uppercase text-slate-400">
                  Project Manager
                </div>
                <div className="font-medium text-slate-800">
                  {project.pm?.full_name ?? "Unassigned"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <UserRound className="h-4 w-4 text-slate-400"/>
              <div>
                <div className="text-[10px] uppercase text-slate-400">
                  Client
                </div>
                <div className="font-medium text-slate-800">
                  {project.client?.full_name ?? "Unassigned"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CalendarRange className="h-4 w-4 text-slate-400"/>
              <div>
                <div className="text-[10px] uppercase text-slate-400">
                  Timeline
                </div>
                <div className="font-medium text-slate-800">
                  {formatDisplayDate(project.start_date)} →{" "}
                  {formatDisplayDate(project.end_date)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={isClient
            ? "border border-stone-200/90 bg-white p-5"
            : "border border-slate-200 bg-white p-5"}>
          <h3 className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Team Members
          </h3>
          {!members || members.length === 0 ? (<p className="text-sm text-slate-500">No members assigned yet.</p>) : (<div className="space-y-3">
              {members.map((m) => {
                const p = m.profiles;
                return (<div key={m.user_id} className="flex items-center justify-between">
                    <span className="text-sm text-slate-800">
                      {p?.full_name ?? "Unknown"}
                    </span>
                    {p?.role ? <RoleBadge role={p.role}/> : null}
                  </div>);
            })}
            </div>)}
        </section>
      </div>
    </div>);
}
