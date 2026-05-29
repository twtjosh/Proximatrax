import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarRange, LayoutGrid, Timer, } from "lucide-react";
import { ProjectMessagesQuickLink } from "@/components/chat/project-messages-quick-link";
import { ProjectInviteStatusBanner } from "@/components/projects/project-invite-status-banner";
import { ProjectClosedBanner } from "@/components/projects/project-closed-banner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { projectBoardPath, projectTimelinePath, ROUTES, } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { countUnreadChatMessages } from "@/services/chat-presence-service";
import { listInvitationsForProject } from "@/services/project-invitation-service";
import { getProjectById } from "@/services/project-service";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";
import type { UserRole } from "@/types/enums";
import { ProjectWorkspaceShell } from "@/components/projects/project-workspace-shell";
import { ProjectTabs } from "./project-tabs";
function formatDate(value: string) {
    return new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}
function initials(name: string) {
    return name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}
export default async function ProjectLayout(props: {
    children: React.ReactNode;
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
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
    const viewerRole = (profile as Pick<Profile, "role"> | null)?.role as UserRole | undefined;
    if (viewerRole === "super_admin") {
        redirect(ROUTES.DASHBOARD);
    }
    if (!viewerRole) {
        redirect(ROUTES.LOGIN);
    }
    const isClient = viewerRole === "client";
    const isPm = viewerRole === "project_manager";
    const project = await getProjectById(id, supabase);
    if (!project)
        notFound();
    const projectInvitations = isPm && project.status === "pending_invites"
        ? await listInvitationsForProject(id, supabase)
        : [];
    const unreadChatCount = await countUnreadChatMessages(id, user.id, supabase);
    let progressPct = 0;
    let progressDetail = "";
    let progressSub = "";
    let delayed = 0;
    if (isClient) {
        const projectWithMilestones = await getProjectById(id, supabase, {
            withMilestones: true,
        });
        const milestones = projectWithMilestones?.milestones ?? [];
        const completed = milestones.filter((m) => m.completed).length;
        progressPct = milestones.length
            ? Math.round((completed / milestones.length) * 100)
            : 0;
        progressDetail = `${completed}/${Math.max(milestones.length, 1)} milestones`;
        const today = new Date().toISOString().slice(0, 10);
        delayed = milestones.filter((m) => !m.completed && m.due_date < today).length;
        progressSub = delayed > 0 ? `${delayed} overdue` : "On schedule";
    }
    else {
        const { data: taskRows } = await supabase
            .from("tasks")
            .select("stage, due_date")
            .eq("project_id", id);
        const tasks = taskRows ?? [];
        const total = tasks.length;
        const done = tasks.filter((t) => t.stage === "done").length;
        progressPct = total ? Math.round((done / Math.max(total, 1)) * 100) : 0;
        progressDetail = `${done}/${Math.max(total, 1)} tasks in Done`;
        const today = new Date().toISOString().slice(0, 10);
        delayed = tasks.filter((t) => t.stage !== "done" &&
            t.due_date &&
            typeof t.due_date === "string" &&
            t.due_date < today).length;
        progressSub = delayed > 0 ? `${delayed} overdue` : "On schedule";
    }
    const { data: memberRows } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", id)
        .limit(8);
    const corePeople = [project.pm, project.client].filter(Boolean) as Pick<Profile, "id" | "full_name" | "avatar_url">[];
    const memberIds = (memberRows ?? []).map((m) => m.user_id);
    let memberProfiles: Pick<Profile, "id" | "full_name" | "avatar_url">[] = [];
    if (memberIds.length > 0) {
        const { data: mp } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", memberIds);
        memberProfiles = (mp ?? []) as Pick<Profile, "id" | "full_name" | "avatar_url">[];
    }
    const rosterMap = new Map<string, Pick<Profile, "id" | "full_name" | "avatar_url">>();
    for (const p of [...corePeople, ...memberProfiles]) {
        rosterMap.set(p.id, p);
    }
    const roster = Array.from(rosterMap.values()).slice(0, 6);
    const headerBeforeTabs = (<>
      <Link href={viewerRole === "middleman" ? ROUTES.MIDDLEMAN_HOME : ROUTES.PROJECTS} className={cn("header-back-link mb-1 inline-flex items-center gap-2 text-[12px] font-medium tracking-wide", isClient
            ? "text-stone-500 hover:text-stone-900"
            : "font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500 hover:text-slate-950")}>
          <ArrowLeft className="h-3.5 w-3.5"/>
          {viewerRole === "middleman" ? "Back to field home" : "Back to projects"}
        </Link>

        <div className="header-meta-row flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="header-primary min-w-0 space-y-3">
            <p className={cn("header-kicker text-[10px] uppercase tracking-[0.2em]", isClient
            ? "font-medium text-amber-800/90"
            : "font-mono tracking-[0.24em] text-[#d97706]")}>
              {viewerRole === "middleman"
            ? "Field execution"
            : viewerRole === "client"
                ? "Your engagement"
                : "Live workspace"}
            </p>
            <div className="flex flex-wrap items-center gap-3 gap-y-2">
              <h1 className={cn("header-title font-heading text-2xl tracking-tight sm:text-3xl", isClient ? "font-semibold text-stone-900" : "text-slate-950")}>
                {project.title}
              </h1>
            </div>
            {project.description ? (<p className={cn("header-description max-w-3xl text-sm leading-relaxed", isClient ? "text-stone-600" : "text-slate-600")}>
                {project.description}
              </p>) : null}
            <div className={cn("header-meta-details flex flex-wrap gap-x-6 gap-y-2 text-xs", isClient ? "text-stone-600" : "text-slate-600")}>
              {isClient ? (<span className="inline-flex items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                    Project manager
                  </span>
                  <span className="font-medium text-stone-900">
                    {project.pm?.full_name ?? "—"}
                  </span>
                </span>) : (<span className="inline-flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    Client
                  </span>
                  <span className="font-medium text-slate-900">
                    {project.client?.full_name ?? "—"}
                  </span>
                </span>)}
              <span className="inline-flex items-center gap-2">
                <CalendarRange className={cn("h-3.5 w-3.5", isClient ? "text-stone-400" : "text-slate-400")}/>
                {formatDate(project.start_date)} → {formatDate(project.end_date)}
              </span>
            </div>
          </div>

          <div className={cn("header-progress-card flex w-full flex-col gap-4 border p-4 sm:max-w-sm lg:w-80 lg:shrink-0", isClient
            ? "rounded-2xl border-stone-200/90 bg-white shadow-sm"
            : "border-slate-200 bg-white shadow-sm")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={cn("text-[10px] uppercase tracking-[0.2em]", isClient ? "font-medium text-stone-500" : "font-mono text-slate-500")}>
                  {isClient ? "Milestone progress" : "Progress"}
                </p>
                <p className={cn("header-progress-pct font-heading text-2xl tabular-nums", isClient ? "font-semibold text-stone-900" : "text-slate-950")}>
                  {progressPct}%
                </p>
              </div>
              <div className="header-progress-detail text-right text-[11px] text-stone-500">
                <p>{progressDetail}</p>
                <p className={cn("mt-1 font-medium", delayed > 0 ? "text-amber-700" : "text-emerald-700")}>
                  {progressSub}
                </p>
              </div>
            </div>
            <div className={cn("h-1.5 w-full rounded-full", isClient ? "bg-stone-100" : "bg-slate-100")}>
              <div className={cn("h-full transition-all", isClient ? "rounded-full bg-linear-to-r from-amber-600 to-amber-500" : "bg-[#d97706]")} style={{ width: `${progressPct}%` }}/>
            </div>
            <div className={cn("header-progress-roster-row", isClient ? "flex flex-col gap-3" : "flex items-center justify-between")}>
              <div className="header-roster flex -space-x-2">
                {roster.map((p) => (<Avatar key={p.id} className={cn("h-9 w-9 border-2 border-white", isClient ? "ring-1 ring-stone-200" : "ring-1 ring-slate-200")} title={p.full_name}>
                    {p.avatar_url ? <AvatarImage src={p.avatar_url} alt=""/> : null}
                    <AvatarFallback className="bg-[#1e293b] text-[10px] text-white">
                      {initials(p.full_name)}
                    </AvatarFallback>
                  </Avatar>))}
              </div>
              <div className={cn("header-quick-actions", isClient
            ? "grid w-full grid-cols-2 gap-2"
            : "flex flex-wrap justify-end gap-1.5")}>
                <Button render={<Link href={projectBoardPath(id)}/>} size="sm" variant="outline" className={cn("text-[10px] uppercase tracking-wide", isClient
            ? "h-11 w-full min-w-0 justify-center gap-1.5 rounded-lg border-stone-200 px-2 font-medium normal-case sm:text-[11px]"
            : "h-8 rounded-none border-slate-200 px-2 font-mono")}>
                  <LayoutGrid className="h-3.5 w-3.5 shrink-0"/>
                  {isClient ? "Updates" : viewerRole === "project_manager" ? "Inspection" : "Board"}
                </Button>
                <Button render={<Link href={projectTimelinePath(id)}/>} size="sm" variant="outline" className={cn("text-[10px] uppercase tracking-wide", isClient
            ? "h-11 w-full min-w-0 justify-center gap-1.5 rounded-lg border-stone-200 px-2 font-medium normal-case sm:text-[11px]"
            : "h-8 rounded-none border-slate-200 px-2 font-mono")}>
                  <Timer className="h-3.5 w-3.5 shrink-0"/>
                  {isClient ? "Timeline" : "Time"}
                </Button>
                <ProjectMessagesQuickLink projectId={id} viewerId={user.id} initialUnreadChatCount={unreadChatCount} isClient={isClient}/>
              </div>
            </div>
          </div>
        </div>

    </>);
    return (<ProjectWorkspaceShell projectId={id} isClient={isClient} headerBeforeTabs={headerBeforeTabs} tabs={<ProjectTabs projectId={id} viewerRole={viewerRole} viewerId={user.id} initialUnreadChatCount={unreadChatCount}/>}>
      {isPm ? (<ProjectInviteStatusBanner invitations={projectInvitations} projectStatus={project.status}/>) : null}
      <ProjectClosedBanner project={project} variant={isClient ? "client" : viewerRole === "middleman" ? "middleman" : "pm"}/>
      {props.children}
    </ProjectWorkspaceShell>);
}
