import { redirect } from "next/navigation";
import { projectPath } from "@/lib/constants";

/** Project settings open as a panel over the project now; this address opens it. */
export default async function ProjectSettingsPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    redirect(`${projectPath(id)}?panel=settings`);
}
