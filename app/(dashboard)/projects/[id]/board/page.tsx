import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ClientProjectProgress } from "@/components/dashboard/client-project-progress";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
import { projectPath, ROUTES } from "@/lib/constants";
import { getViewer } from "@/lib/supabase/server";
import { listApprovedAttachmentsForProject, listTaskAttachmentsForProject, } from "@/services/task-attachment-service";
import { getProjectById } from "@/services/project-service";
import { listClientVisibleDeliverables, listTasksForProject, } from "@/services/task-service";
import type { Profile } from "@/types/database";
import type { UserRole } from "@/types/enums";
export default async function ProjectBoardPage(props: {
    params: Promise<{
        id: string;
    }>;
    searchParams: Promise<{
        view?: string;
    }>;
}) {
    const { id } = await props.params;
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    const role = (profile as Pick<Profile, "role"> | null)?.role as UserRole | undefined;
    if (!role)
        redirect(ROUTES.LOGIN);
    if (role === "middleman")
        redirect(projectPath(id));
    const [project, tasks, attachments] = await Promise.all([
        getProjectById(id, supabase),
        listTasksForProject(id, supabase),
        listTaskAttachmentsForProject(id, supabase),
    ]);
    const isArchived = project?.status === "completed";
    const loading = (<div className="flex items-center gap-2 border border-slate-200 bg-white p-8 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin"/>
      Loading…
    </div>);
    if (role === "client") {
        const project = await getProjectById(id, supabase, { withMilestones: true });
        const deliverables = await listClientVisibleDeliverables(id, supabase);
        const approvedPhotos = await listApprovedAttachmentsForProject(id, supabase);
        return (<div className="space-y-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
            Your project
          </p>
          <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight text-stone-900">
            Progress & updates
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            Milestone progress and site photos your project manager has approved —
            no internal task boards, just what matters to you.
          </p>
        </div>
        <ClientProjectProgress projectId={id} milestones={project?.milestones ?? []} tasks={tasks} deliverables={deliverables} approvedPhotos={approvedPhotos}/>
      </div>);
    }
    if (role === "project_manager") {
        return (<div className="pt-2">
        <Suspense fallback={loading}>
          <KanbanBoard projectId={id} initialTasks={tasks} initialAttachments={attachments} viewerRole={role} viewerId={user.id} isArchived={isArchived}/>
        </Suspense>
      </div>);
    }
    redirect(ROUTES.DASHBOARD);
}
