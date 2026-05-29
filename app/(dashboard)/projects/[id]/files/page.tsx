import { redirect } from "next/navigation";
import { projectMessagesPath } from "@/lib/constants";
export default async function ProjectFilesPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    redirect(`${projectMessagesPath(id)}?media=1`);
}
