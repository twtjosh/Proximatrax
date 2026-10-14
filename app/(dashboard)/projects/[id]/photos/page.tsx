import { notFound, redirect } from "next/navigation";
import { ClientPhotos } from "@/components/projects/client/client-photos";
import { SharedDocuments } from "@/components/projects/client/shared-documents";
import { CrewPhotos } from "@/components/projects/crew/crew-photos";
import { projectFilesPath, ROUTES } from "@/lib/constants";
import { loadClientProject } from "@/lib/data/client-project";
import { loadCrewProject } from "@/lib/data/crew-project";
import { getViewer } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/** Photos: the crew's own uploads by task; the client's approved gallery and shared documents. The PM's are under Files. */
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
    if (role === "client") {
        const data = await loadClientProject(supabase, id, user.id);
        if (!data)
            notFound();
        return (<div className="grid gap-6">
          <SharedDocuments files={data.documents}/>
          <ClientPhotos data={data}/>
        </div>);
    }
    redirect(projectFilesPath(id));
}
