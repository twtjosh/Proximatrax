import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, Loader2 } from "lucide-react";
import { ClientProjectProgress } from "@/components/dashboard/client-project-progress";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
import { MiddlemanFieldWork } from "@/components/dashboard/middleman-field-work";
import { PmInspectionQueue } from "@/components/dashboard/pm-inspection-queue";
import { Button } from "@/components/ui/button";
import { projectBoardPath, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
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
    const { view } = await props.searchParams;
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user)
        redirect(ROUTES.LOGIN);
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
    const role = (profile as Pick<Profile, "role"> | null)?.role as UserRole | undefined;
    if (!role)
        redirect(ROUTES.LOGIN);
    const project = await getProjectById(id, supabase);
    const isArchived = project?.status === "completed";
    const tasks = await listTasksForProject(id, supabase);
    const attachments = await listTaskAttachmentsForProject(id, supabase);
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
    if (role === "middleman") {
        return (<div className="space-y-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
            Field work
          </p>
          <h2 className="font-heading text-xl tracking-tight text-slate-950">
            My assigned work
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Tap a task to upload site photos, then submit for PM review — no
            dragging columns or checklists.
          </p>
        </div>
        <Suspense fallback={loading}>
          <MiddlemanFieldWork projectId={id} viewerId={user.id} initialTasks={tasks} initialAttachments={attachments}/>
        </Suspense>
      </div>);
    }
    if (role === "project_manager" && view === "all") {
        return (<div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
              Task management
            </p>
            <h2 className="mt-0.5 font-heading text-lg font-semibold tracking-tight text-slate-950">
              All tasks
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Full board for creating tasks, assigning owners, and reordering work.
            </p>
          </div>
          <Button render={<Link href={projectBoardPath(id)}/>} variant="outline" className="h-9 shrink-0 gap-1.5 rounded-lg border-slate-200/90 bg-white px-3.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-copper/35 hover:bg-copper-soft/30 hover:text-copper-hover">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden/>
            Inspection queue
          </Button>
        </div>
        <Suspense fallback={loading}>
          <KanbanBoard projectId={id} initialTasks={tasks} initialAttachments={attachments} viewerRole={role} viewerId={user.id} isArchived={isArchived}/>
        </Suspense>
      </div>);
    }
    if (role === "project_manager") {
        return (<div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
              Quality check
            </p>
            <h2 className="mt-0.5 font-heading text-lg font-semibold tracking-tight text-slate-950">
              Inspection queue
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Review submitted field work and accept deliverables for your client.
            </p>
          </div>
          <Button render={<Link href={projectBoardPath(id, { view: "all" })}/>} variant="outline" className="h-9 shrink-0 gap-1.5 rounded-lg border-slate-200/90 bg-white px-3.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-copper/35 hover:bg-copper-soft/30 hover:text-copper-hover">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden/>
            Manage all tasks
          </Button>
        </div>
        <Suspense fallback={loading}>
          <PmInspectionQueue projectId={id} initialTasks={tasks} initialAttachments={attachments}/>
        </Suspense>
      </div>);
    }
    redirect(ROUTES.DASHBOARD);
}
