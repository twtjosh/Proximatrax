import { redirect } from "next/navigation";
import { getRoleHomePath, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
export default async function ActivityPage() {
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user)
        redirect(ROUTES.LOGIN);
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
    redirect(getRoleHomePath((profile as {
        role?: string;
    } | null)?.role));
}
