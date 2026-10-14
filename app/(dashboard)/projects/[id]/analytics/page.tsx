import { redirect } from "next/navigation";
import { projectPath } from "@/lib/constants";

/** The old client Analytics tab showed sample market prices; its address now opens the project. */
export default async function ProjectAnalyticsPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    redirect(projectPath(id));
}
