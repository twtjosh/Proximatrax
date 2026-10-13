import { redirect } from "next/navigation";
import { getRoleHomePath, ROUTES } from "@/lib/constants";
import { getViewer } from "@/lib/supabase/server";
export default async function ActivityPage() {
    const { user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    redirect(getRoleHomePath((profile as {
        role?: string;
    } | null)?.role));
}
