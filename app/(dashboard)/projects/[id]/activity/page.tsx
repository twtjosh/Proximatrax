import { notFound, redirect } from "next/navigation";
import { projectPath, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
export default async function ProjectActivityPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user)
        redirect(ROUTES.LOGIN);
    const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
    if (!profile)
        notFound();
    redirect(projectPath(id));
}
