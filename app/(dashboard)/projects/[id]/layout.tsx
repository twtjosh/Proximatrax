import { notFound, redirect } from "next/navigation";
import { ClientProjectShell } from "@/components/projects/client/client-project-shell";
import { CrewProjectShell } from "@/components/projects/crew/crew-project-shell";
import { OwnerProjectShell } from "@/components/projects/owner/owner-project-shell";
import { PmProjectShell } from "@/components/projects/pm/pm-project-shell";
import { ROUTES } from "@/lib/constants";
import { loadClientProject } from "@/lib/data/client-project";
import { loadCrewProject } from "@/lib/data/crew-project";
import { loadPmProject } from "@/lib/data/pm-project";
import { getViewer } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/** Each role's own frame around a project; the super admin's is the PM's tabs, read only. The loaders are cached per request, so the pages beneath reuse them. */
export default async function ProjectLayout(props: {
    children: React.ReactNode;
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    const role = (profile as Pick<Profile, "role"> | null)?.role;
    if (role === "project_manager") {
        const data = await loadPmProject(supabase, id);
        if (!data)
            notFound();
        return <PmProjectShell data={data} viewerId={user.id}>{props.children}</PmProjectShell>;
    }
    if (role === "super_admin") {
        const data = await loadPmProject(supabase, id);
        if (!data)
            notFound();
        return <OwnerProjectShell data={data}>{props.children}</OwnerProjectShell>;
    }
    if (role === "middleman") {
        const data = await loadCrewProject(supabase, id, user.id);
        if (!data)
            notFound();
        return <CrewProjectShell data={data} viewerId={user.id}>{props.children}</CrewProjectShell>;
    }
    if (role === "client") {
        const data = await loadClientProject(supabase, id);
        if (!data)
            notFound();
        return <ClientProjectShell data={data}>{props.children}</ClientProjectShell>;
    }
    redirect(ROUTES.DASHBOARD);
}
