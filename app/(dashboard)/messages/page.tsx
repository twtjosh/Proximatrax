import { redirect } from "next/navigation";
import { MessagesScreen } from "@/components/messenger/messages-screen";
import { projectPath, ROUTES } from "@/lib/constants";
import { getViewer } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/** Clients' and crew's conversations as a screen of their own; everyone else keeps the messenger panel. */
export default async function MessagesPage(props: {
    searchParams: Promise<{
        project?: string;
    }>;
}) {
    const { user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    const me = profile as Profile | null;
    const { project } = await props.searchParams;
    if (!me || (me.role !== "client" && me.role !== "middleman"))
        redirect(project ? `${projectPath(project)}?chat=${project}` : ROUTES.DASHBOARD);
    return <MessagesScreen viewer={{ id: me.id, full_name: me.full_name, avatar_url: me.avatar_url }} projectId={project ?? null}/>;
}
