import { notFound, redirect } from "next/navigation";
import { UpdateProjectForm } from "@/components/projects/update-project-form";
import { projectPath, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/services/project-service";
import type { Profile } from "@/types/database";
export default async function ProjectSettingsPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
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
    const project = await getProjectById(id, supabase);
    if (!project)
        notFound();
    if (role === "middleman" || role === "client") {
        redirect(projectPath(id));
    }
    const canEdit = role === "project_manager";
    return (<div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
          Workspace configuration
        </p>
        <h2 className="font-heading text-lg tracking-tight text-slate-950">
          Settings
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Control how this engagement appears across the board, timeline, and client portal. Only
          project managers can change operational metadata.
        </p>
      </div>

      {canEdit ? (<UpdateProjectForm project={project}/>) : (<div className="border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          You have read-only access to this project. Contact the assigned project manager if dates
          need to change.
        </div>)}
    </div>);
}
