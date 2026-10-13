import Link from "next/link";
import { Check } from "lucide-react";
import { OverviewCard, primaryAction, softAction, stagger } from "@/components/dashboard/overview-kit";
import { formatDate } from "@/lib/dashboard";
import { projectBoardPath, projectTimelinePath } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ROLE_TERMS } from "@/lib/vocabulary";
import type { ProjectInvitationWithInvitee } from "@/types/database";
import type { ProjectStatus } from "@/types/enums";

const INVITE_STATE = { accepted: "joined", pending: "hasn't replied yet", declined: "declined" } as const;

/** A new project's Overview: the four steps to a running project, built from real states. */
export function SetupChecklist({ projectId, title, start, end, status, invitations, milestoneCount, taskCount }: {
    projectId: string;
    title: string;
    start: string;
    end: string;
    status: ProjectStatus;
    invitations: ProjectInvitationWithInvitee[];
    milestoneCount: number;
    taskCount: number;
}) {
    const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });
    const teamDetail = status !== "pending_invites"
        ? "Everyone invited has joined"
        : invitations.length === 0
            ? "Waiting on invitations"
            : invitations.map((i) => `${i.invitee?.full_name ?? "Someone"} (${ROLE_TERMS[i.invitee_role].toLowerCase()}) ${INVITE_STATE[i.status as keyof typeof INVITE_STATE] ?? i.status}`).join(" · ");
    const steps = [
        { title: "Project created", detail: `${short(start)} to ${short(end)}`, done: true },
        { title: "Team joins", detail: teamDetail, done: status !== "pending_invites" },
        { title: "Lay out milestones", detail: milestoneCount > 0 ? `${milestoneCount} planned` : "Survey, design, production, install, turnover, or your own", done: milestoneCount > 0, href: projectTimelinePath(projectId), cta: "Add milestones" },
        { title: "Assign the first tasks", detail: taskCount > 0 ? `${taskCount} on the board` : "Give the site team its first work", done: taskCount > 0, href: projectBoardPath(projectId, { view: "all" }), cta: "Add tasks" },
    ];
    const current = steps.findIndex((s) => !s.done);
    return (<OverviewCard id="project-setup" title={`Get ${title} ready`} aside={`${steps.filter((s) => s.done).length} of ${steps.length} done`} className="materialize" style={stagger(1)}>
      <ol className="pb-2">
        {steps.map((s, i) => (<li key={s.title} className="flex items-center gap-4 border-t border-line px-5 py-3.5 first:border-t-0 sm:px-6">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold", s.done ? "bg-stage-done text-white" : i === current ? "bg-brand-soft text-brand ring-2 ring-copper" : "text-ink-tertiary ring-2 ring-line")} aria-hidden>
              {s.done ? <Check className="size-3.5" strokeWidth={3}/> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm font-medium", s.done ? "text-ink-secondary" : "text-ink")}>{s.title}<span className="sr-only">{s.done ? ", done" : ""}</span></span>
              <span className="block text-xs text-ink-tertiary">{s.detail}</span>
            </span>
            {!s.done && s.href ? <Link href={s.href} className={i === current ? cn(primaryAction, "h-8 px-4 text-xs") : softAction}>{s.cta}</Link> : null}
          </li>))}
      </ol>
    </OverviewCard>);
}
