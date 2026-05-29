import { notFound, redirect } from "next/navigation";

import { ClientMarketInsightPanel } from "@/components/client-portal/client-market-insight-panel";
import { projectPath, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/services/project-service";
import type { Profile } from "@/types/database";

export default async function ProjectAnalyticsPage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.LOGIN);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile as Pick<Profile, "role"> | null)?.role;
  if (role !== "client") {
    redirect(projectPath(id));
  }

  const project = await getProjectById(id, supabase);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-stone-500">
          Predictive analytics
        </p>
        <h2 className="font-heading text-lg font-semibold tracking-tight text-stone-900">
          Market price insight
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          See how your agreed project value compares to typical market ranges for similar scope and
          location.
        </p>
      </div>

      <ClientMarketInsightPanel projectTitle={project.title} />
    </div>
  );
}
