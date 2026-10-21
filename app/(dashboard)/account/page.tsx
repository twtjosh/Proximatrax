import { redirect } from "next/navigation";
import { ProfileView } from "@/components/shell/profile-view";
import { ROUTES } from "@/lib/constants";
import { getViewer } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
export default async function AccountPage() {
    const { user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    const resolved = profile as Profile | null;
    if (!resolved)
        redirect(ROUTES.LOGIN);
    if (resolved.role === "super_admin")
        redirect(ROUTES.DASHBOARD);
    return <ProfileView profile={resolved} email={user.email ?? null}/>;
}
