import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";
import { MiddlemanWorkToday } from "@/components/middleman/middleman-work-today";
import { ProjectInvitationsInbox } from "@/components/projects/project-invitations-inbox";
import { Button } from "@/components/ui/button";
import { projectBoardPath, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { listPendingInvitationsForUser } from "@/services/project-invitation-service";
import { listTaskAttachmentsForProject } from "@/services/task-attachment-service";
import { listProjects } from "@/services/project-service";
import { listAssignedTasksForUser } from "@/services/task-service";
import type { Profile } from "@/types/database";
export const dynamic = "force-dynamic";
export default async function MiddlemanHomePage() {
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user)
        redirect(ROUTES.LOGIN);
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
    const role = (profile as Pick<Profile, "role"> | null)?.role;
    if (role !== "middleman") {
        redirect(ROUTES.DASHBOARD);
    }
    const [projects, assignedTasks, pendingInvitations] = await Promise.all([
        listProjects(supabase, { lifecycle: "active" }),
        listAssignedTasksForUser(user.id, supabase),
        listPendingInvitationsForUser(user.id, supabase),
    ]);
    const projectIds = [...new Set(assignedTasks.map((t) => t.project_id))];
    const attachmentLists = await Promise.all(projectIds.map((id) => listTaskAttachmentsForProject(id, supabase)));
    const attachments = attachmentLists.flat();
    return (<div className="mx-auto max-w-2xl space-y-10 pb-10">
      <header className="border-b border-slate-200 pb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d97706]">
          Field workspace
        </p>
        <div className="mt-3 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-slate-950">
              My work today
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-slate-600">
              Assigned tasks across your sites — upload photos and submit for PM
              review without opening the full board.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[11px] tabular-nums text-slate-700">
              {assignedTasks.length} active
            </span>
            <Button render={<Link href={ROUTES.PROJECTS}/>} variant="outline" className="h-9 rounded-md border-slate-200 px-4 text-sm">
              <Building2 className="mr-2 h-4 w-4"/>
              All projects
            </Button>
            <Button render={<Link href={ROUTES.MIDDLEMAN_ACCOUNT}/>} variant="outline" className="h-9 rounded-md border-slate-200 px-4 text-sm">
              Account
            </Button>
          </div>
        </div>
      </header>

      <ProjectInvitationsInbox invitations={pendingInvitations}/>

      <section className="space-y-4">
        <MiddlemanWorkToday viewerId={user.id} initialTasks={assignedTasks} initialAttachments={attachments}/>
      </section>

      {projects.length > 0 ? (<section className="space-y-3 border-t border-slate-200 pt-8">
          <h2 className="font-heading text-base font-medium text-slate-800">
            Your projects
          </h2>
          <ul className="space-y-2">
            {projects.slice(0, 6).map((p) => (<li key={p.id}>
                <Link href={projectBoardPath(p.id)} className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm transition-colors hover:border-[#d97706]/40">
                  <span className="font-medium text-slate-900">{p.title}</span>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#d97706]"/>
                </Link>
              </li>))}
          </ul>
        </section>) : null}
    </div>);
}
