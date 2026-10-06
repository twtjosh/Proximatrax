"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, Check, Loader2, Mail, X } from "lucide-react";
import { acceptProjectInvitationAction, declineProjectInvitationAction, } from "@/app/(dashboard)/invitations/actions";
import { Button } from "@/components/ui/button";
import { projectBoardPath, projectPath } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ROLE_TERMS } from "@/lib/vocabulary";
import type { ProjectInvitationWithInviter } from "@/types/database";
type ProjectInvitationsInboxProps = {
    invitations: ProjectInvitationWithInviter[];
    className?: string;
};
export function ProjectInvitationsInbox({ invitations, className, }: ProjectInvitationsInboxProps) {
    const router = useRouter();
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    if (invitations.length === 0)
        return null;
    function handleAccept(invitationId: string) {
        setError(null);
        setPendingId(invitationId);
        startTransition(async () => {
            const result = await acceptProjectInvitationAction(invitationId);
            setPendingId(null);
            if (!result.ok) {
                setError(result.error);
                return;
            }
            const destination = result.inviteeRole === "middleman"
                ? projectBoardPath(result.projectId)
                : projectPath(result.projectId);
            router.push(destination);
            router.refresh();
        });
    }
    function handleDecline(invitationId: string) {
        setError(null);
        setPendingId(invitationId);
        startTransition(async () => {
            const result = await declineProjectInvitationAction(invitationId);
            setPendingId(null);
            if (!result.ok) {
                setError(result.error);
                return;
            }
            router.refresh();
        });
    }
    return (<section aria-labelledby="invitations-heading" className={cn("rounded-[20px] material overflow-hidden", className)}>
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden>
          <Mail className="size-4"/>
        </span>
        <div className="min-w-0">
          <h2 id="invitations-heading" className="type-title text-ink">
            {invitations.length === 1 ? "You're invited to a project" : `You're invited to ${invitations.length} projects`}
          </h2>
          <p className="type-caption text-ink-tertiary">Accept to join its team and see its work.</p>
        </div>
      </div>

      {error ? (<p role="alert" className="mx-5 mb-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>) : null}

      <ul className="px-2 pb-2">
        {invitations.map((inv) => {
            const busy = isPending && pendingId === inv.id;
            const pmName = inv.inviter?.full_name ?? "Project manager";
            return (<li key={inv.id} className="flex flex-col gap-3 rounded-2xl px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <Building2 className="mt-0.5 size-4 shrink-0 text-ink-tertiary" aria-hidden/>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {inv.project_title}
                    <span className="ml-2 text-xs font-normal text-ink-tertiary">as {ROLE_TERMS[inv.invitee_role].toLowerCase()}</span>
                  </p>
                  <p className="type-caption mt-0.5 text-ink-secondary">
                    From {pmName}
                    {" · "}
                    {new Date(inv.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 gap-2 pl-7 sm:pl-0">
                <Button type="button" variant="ghost" disabled={busy} onClick={() => handleDecline(inv.id)} className="press h-9 rounded-full px-4">
                  <X aria-hidden/>
                  Decline
                </Button>
                <Button type="button" variant="default" disabled={busy} onClick={() => handleAccept(inv.id)} className="press h-9 rounded-full px-4">
                  {busy ? <Loader2 className="animate-spin" aria-hidden/> : <Check aria-hidden/>}
                  Accept
                </Button>
              </div>
            </li>);
        })}
      </ul>
    </section>);
}
