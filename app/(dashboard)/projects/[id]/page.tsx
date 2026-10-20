import { notFound, redirect } from "next/navigation";
import { ClientOverview } from "@/components/projects/client/client-overview";
import { CrewOverview } from "@/components/projects/crew/crew-overview";
import { PmOverview } from "@/components/projects/pm/pm-overview";
import { ROUTES } from "@/lib/constants";
import { loadClientProject } from "@/lib/data/client-project";
import { loadCrewProject } from "@/lib/data/crew-project";
import { loadPmProject } from "@/lib/data/pm-project";
import { getViewer } from "@/lib/supabase/server";
import { listProjectAssignees } from "@/services/project-service";
import type { Profile } from "@/types/database";

/** A project's Overview, for each role. */
export default async function ProjectOverviewPage(props: {
    params: Promise<{
        id: string;
    }>;
    searchParams: Promise<{
        task?: string;
    }>;
}) {
    const { id } = await props.params;
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    const role = (profile as Pick<Profile, "role"> | null)?.role;
    if (role === "project_manager") {
        const [data, people] = await Promise.all([loadPmProject(supabase, id), listProjectAssignees(id, supabase)]);
        if (!data)
            notFound();
        return <PmOverview data={data} viewerId={user.id} people={people}/>;
    }
    if (role === "middleman") {
        const data = await loadCrewProject(supabase, id, user.id);
        if (!data)
            notFound();
        const { task } = await props.searchParams;
        return <CrewOverview data={data} viewerId={user.id} openTask={task ?? null}/>;
    }
    if (role === "client") {
        const data = await loadClientProject(supabase, id);
        if (!data)
            notFound();
        return <ClientOverview data={data}/>;
    }
    notFound();
}
