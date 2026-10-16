import { redirect } from "next/navigation";
import { projectPath } from "@/lib/constants";

/** The project report opens as a print preview over the project now; this address opens it. */
export default async function ProjectReportPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    redirect(`${projectPath(id)}?panel=report`);
}
