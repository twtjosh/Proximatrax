import { redirect } from "next/navigation";
import { OverviewHeader, stagger } from "@/components/dashboard/overview-kit";
import { FieldToday } from "@/components/middleman/field-today";
import { ProjectInvitationsInbox } from "@/components/projects/project-invitations-inbox";
import { ROUTES } from "@/lib/constants";
import { formatDate, greeting, isoDateIn, plural } from "@/lib/dashboard";
import { loadSentBack } from "@/lib/data/sent-back";
import { getViewer } from "@/lib/supabase/server";
import { listPendingInvitationsForUser } from "@/services/project-invitation-service";
import { listTaskAttachmentsForProject } from "@/services/task-attachment-service";
import { listAssignedTasksForUser } from "@/services/task-service";
import type { Profile } from "@/types/database";
export const dynamic = "force-dynamic";

export default async function MiddlemanHomePage() {
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
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
