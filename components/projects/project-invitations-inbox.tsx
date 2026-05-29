"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, Check, Loader2, Mail, X } from "lucide-react";
import { acceptProjectInvitationAction, declineProjectInvitationAction, } from "@/app/(dashboard)/invitations/actions";
import { Button } from "@/components/ui/button";
import { projectBoardPath, projectPath } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ProjectInvitationWithInviter } from "@/types/database";
type ProjectInvitationsInboxProps = {
    invitations: ProjectInvitationWithInviter[];
    className?: string;
};
const ROLE_LABELS = {
    client: "Client",
    middleman: "Field coordinator",
} as const;
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
    return (<section className={cn("overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/50 shadow-sm", className)}>
      <div className="flex items-center gap-3 border-b border-amber-200/60 bg-white/70 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-100 text-amber-800">
          <Mail className="h-4 w-4" aria-hidden/>
        </div>
        <div>
          <h2 className="font-heading text-base font-semibold text-zinc-950">
            Project invitations
          </h2>
          <p className="text-sm text-zinc-600">
            {invitations.length} pending — accept to join the workspace roster.
          </p>
        </div>
      </div>

      {error ? (<p className="border-b border-amber-200/60 bg-red-50 px-5 py-3 text-sm text-red-800">
          {error}
        </p>) : null}

      <ul className="divide-y divide-amber-200/50">
        {invitations.map((inv) => {
            const busy = isPending && pendingId === inv.id;
            const pmName = inv.inviter?.full_name ?? "Project manager";
            return (<li key={inv.id} className="flex flex-col gap-4 bg-white/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0 text-amber-700"/>
                  <p className="font-heading text-base font-semibold text-zinc-950">
                    {inv.project_title}
                  </p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900">
                    {ROLE_LABELS[inv.invitee_role]}
                  </span>
                </div>
                <p className="text-sm text-zinc-600">
                  Invited by <span className="font-medium text-zinc-800">{pmName}</span>
                  {" · "}
                  {new Date(inv.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                })}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button type="button" size="sm" disabled={busy} onClick={() => handleAccept(inv.id)} className="h-9 gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800">
                  {busy ? (<Loader2 className="h-3.5 w-3.5 animate-spin"/>) : (<Check className="h-3.5 w-3.5"/>)}
                  Accept
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => handleDecline(inv.id)} className="h-9 gap-1.5 border-zinc-300">
                  <X className="h-3.5 w-3.5"/>
                  Decline
                </Button>
              </div>
            </li>);
        })}
      </ul>
    </section>);
}
