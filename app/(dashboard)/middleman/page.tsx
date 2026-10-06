import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OverviewHeader, stagger } from "@/components/dashboard/overview-kit";
import { FieldToday } from "@/components/middleman/field-today";
import { ProjectInvitationsInbox } from "@/components/projects/project-invitations-inbox";
import { ROUTES } from "@/lib/constants";
import { formatDate, greeting, isoDateIn, plural } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";
import { listPendingInvitationsForUser } from "@/services/project-invitation-service";
import { listTaskAttachmentsForProject } from "@/services/task-attachment-service";
import { listAssignedTasksForUser } from "@/services/task-service";
import type { Profile } from "@/types/database";
export const dynamic = "force-dynamic";

/**
 * In-progress tasks the PM returned from review, with when. A return is logged
 * as a move from review to in progress; a task still in progress after one is
 * waiting to be fixed and resubmitted. Only decorates the page, so failures
 * yield nothing.
 */
async function loadSentBack(supabase: SupabaseClient, tasks: { id: string; project_id: string; stage: string }[]): Promise<Record<string, string>> {
    const underway = new Set(tasks.filter((t) => t.stage === "in_progress").map((t) => t.id));
    if (underway.size === 0)
        return {};
    const { data } = await supabase
        .from("activity_feed")
        .select("details, created_at")
        .eq("action_type", "task_moved")
        .eq("details->>from", "review")
        .eq("details->>to", "in_progress")
        .in("project_id", [...new Set(tasks.map((t) => t.project_id))])
        .order("created_at", { ascending: false });
    const returned: Record<string, string> = {};
    for (const row of (data ?? []) as { details: { task_id?: string }; created_at: string }[]) {
        const id = row.details?.task_id;
        if (id && underway.has(id) && !returned[id])
            returned[id] = row.created_at;
    }
    return returned;
}

export default async function MiddlemanHomePage() {
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user)
        redirect(ROUTES.LOGIN);
    const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();
    const me = profile as Pick<Profile, "role" | "full_name"> | null;
    if (me?.role !== "middleman") {
        redirect(ROUTES.DASHBOARD);
    }
    const [assignedTasks, pendingInvitations] = await Promise.all([
        listAssignedTasksForUser(user.id, supabase),
        listPendingInvitationsForUser(user.id, supabase),
    ]);
    const projectIds = [...new Set(assignedTasks.map((t) => t.project_id))];
    const attachmentLists = await Promise.all(projectIds.map((id) => listTaskAttachmentsForProject(id, supabase)));
    const attachments = attachmentLists.flat();
    const sentBack = await loadSentBack(supabase, assignedTasks);
    const now = new Date();
    const today = isoDateIn(now);

    return (<div className="mx-auto w-full max-w-6xl pb-12">
      <OverviewHeader title={`${greeting(now)}, ${me.full_name?.split(" ")[0] ?? "there"}`} sub={<>
          {formatDate(today, { weekday: "long", month: "long", day: "numeric" })}
          {assignedTasks.length > 0 ? <> · <b>{plural(assignedTasks.length, "task")}</b> on your list</> : " · Your list is clear"}
        </>}/>

      {pendingInvitations.length > 0 ? (<div className="materialize mt-8" style={stagger(1)}>
          <ProjectInvitationsInbox invitations={pendingInvitations}/>
        </div>) : null}

      <FieldToday viewerId={user.id} today={today} initialTasks={assignedTasks} initialAttachments={attachments} sentBack={sentBack}/>

    </div>);
}
