import { redirect } from "next/navigation";
import { projectPath } from "@/lib/constants";

/** Chat lives in the floating messenger; old links open it on this project. */
export default async function ProjectFilesRedirectPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    redirect(`${projectPath(id)}?chat=${id}`);
}
