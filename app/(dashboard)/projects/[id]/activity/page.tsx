import { notFound, redirect } from "next/navigation";
import { projectPath, ROUTES } from "@/lib/constants";
import { getViewer } from "@/lib/supabase/server";
export default async function ProjectActivityPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    const { user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    if (!profile)
        notFound();
    redirect(projectPath(id));
}
