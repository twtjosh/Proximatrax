import { notFound, redirect } from "next/navigation";
import { ProjectFiles } from "@/components/projects/pm/files/project-files";
import { projectPath, ROUTES } from "@/lib/constants";
import { loadPmProject } from "@/lib/data/pm-project";
import { getViewer } from "@/lib/supabase/server";
import { listProjectFiles } from "@/services/project-file-service";
import { listTaskAttachmentsForProject, publicTaskAttachmentUrl } from "@/services/task-attachment-service";

/** The PM's document library and every site photo. Others keep the old link: it opens the chat. */
export default async function ProjectFilesPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    if (profile?.role !== "project_manager")
        redirect(`${projectPath(id)}?chat=${id}`);
    const [data, library, attachments] = await Promise.all([
        loadPmProject(supabase, id, user.id),
        listProjectFiles(id, supabase),
        listTaskAttachmentsForProject(id, supabase),
    ]);
    if (!data)
        notFound();
    const names = Object.fromEntries(data.team.map((m) => [m.id, m.name]));
    const titles = new Map(data.tasks.map((t) => [t.id, t.title]));
    const photos = attachments
        .filter((a) => a.media_kind === "photo")
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((a) => ({ id: a.id, url: publicTaskAttachmentUrl(a.storage_path), taskTitle: titles.get(a.task_id) ?? "Site photo", by: names[a.uploaded_by] ?? "Someone", at: a.created_at, shared: !!a.approved_for_client_at }));
    return <ProjectFiles projectId={id} files={library.files} missing={library.missing} photos={photos} people={names} closed={data.project.status === "completed"}/>;
}
