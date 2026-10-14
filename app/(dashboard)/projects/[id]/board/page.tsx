import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
import { UpdatesFeed } from "@/components/projects/client/updates-feed";
import { projectPath, ROUTES } from "@/lib/constants";
import { loadClientProject } from "@/lib/data/client-project";
import { getViewer } from "@/lib/supabase/server";
import { getProjectById } from "@/services/project-service";
import { listTaskAttachmentsForProject } from "@/services/task-attachment-service";
import { listTasksForProject } from "@/services/task-service";
import type { Profile } from "@/types/database";

/** The PM's board; the client's Updates. Middlemen work from their Overview. */
export default async function ProjectBoardPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    const role = (profile as Pick<Profile, "role"> | null)?.role;
    if (role === "middleman")
        redirect(projectPath(id));
    if (role === "client") {
        const data = await loadClientProject(supabase, id, user.id);
        if (!data)
            notFound();
        return <UpdatesFeed data={data}/>;
    }
    if (role !== "project_manager")
        redirect(ROUTES.DASHBOARD);
    const [project, tasks, attachments] = await Promise.all([
        getProjectById(id, supabase),
        listTasksForProject(id, supabase),
        listTaskAttachmentsForProject(id, supabase),
    ]);
    return (<div className="pt-2">
      <Suspense fallback={<div className="flex items-center gap-2 border border-slate-200 bg-white p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</div>}>
        <KanbanBoard projectId={id} initialTasks={tasks} initialAttachments={attachments} viewerRole="project_manager" viewerId={user.id} isArchived={project?.status === "completed"}/>
      </Suspense>
    </div>);
}
