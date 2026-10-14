import { notFound, redirect } from "next/navigation";
import { CrewPhotos } from "@/components/projects/crew/crew-photos";
import { projectPath, ROUTES } from "@/lib/constants";
import { loadCrewProject } from "@/lib/data/crew-project";
import { getViewer } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/** Photos: the crew's own uploads by task; the client's approved gallery. The PM's photos live on their Overview. */
export default async function ProjectPhotosPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    const role = (profile as Pick<Profile, "role"> | null)?.role;
    if (role === "middleman") {
        const data = await loadCrewProject(supabase, id, user.id);
        if (!data)
            notFound();
        return <CrewPhotos data={data} viewerId={user.id}/>;
    }
    redirect(projectPath(id));
}
