import { redirect } from "next/navigation";
import { projectMessagesPath } from "@/lib/constants";
export default async function ProjectChatRedirectPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    redirect(projectMessagesPath(id));
}
