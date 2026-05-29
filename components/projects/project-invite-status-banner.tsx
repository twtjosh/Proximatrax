import { CheckCircle2, Clock, Mail, XCircle } from "lucide-react";
import type { ProjectInvitationWithInvitee } from "@/types/database";
type ProjectInviteStatusBannerProps = {
    invitations: ProjectInvitationWithInvitee[];
    projectStatus: string;
};
export function ProjectInviteStatusBanner({ invitations, projectStatus, }: ProjectInviteStatusBannerProps) {
    if (projectStatus !== "pending_invites" || invitations.length === 0) {
        return null;
    }
    const pending = invitations.filter((i) => i.status === "pending");
    const declined = invitations.filter((i) => i.status === "declined");
    const allAccepted = invitations.every((i) => i.status === "accepted");
    if (allAccepted || (pending.length === 0 && declined.length === 0)) {
        return null;
    }
    return (<div className="border-b border-amber-200/80 bg-amber-50/90 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-800">
            <Mail className="h-5 w-5"/>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-800">
              Awaiting roster confirmation
            </p>
            <h2 className="mt-1 font-heading text-lg font-semibold text-zinc-950">
              Invitations sent — team must accept before going live
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600">
              You can prepare milestones and settings while waiting. The client and
              field coordinator will not see this project until they accept.
            </p>
          </div>
        </div>

        <ul className="grid min-w-[min(100%,280px)] gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {invitations.map((inv) => {
            const name = inv.invitee?.full_name ?? "Member";
            const roleLabel = inv.invitee_role === "client" ? "Client" : "Middleman";
            return (<li key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200/70 bg-white px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900">{name}</p>
                  <p className="text-xs text-zinc-500">{roleLabel}</p>
                </div>
                <InviteStatusBadge status={inv.status}/>
              </li>);
        })}
        </ul>
      </div>

      {declined.length > 0 ? (<p className="mt-3 text-sm text-red-800">
          {declined.length === 1
                ? "One invite was declined. Choose a different member or cancel this workspace."
                : `${declined.length} invites were declined. Update the roster to continue.`}
        </p>) : null}

      {pending.length > 0 ? (<p className="mt-3 flex items-center gap-2 text-sm text-amber-900">
          <Clock className="h-4 w-4 shrink-0"/>
          Waiting on {pending.length} response{pending.length === 1 ? "" : "s"}.
        </p>) : null}
    </div>);
}
function InviteStatusBadge({ status, }: {
    status: "pending" | "accepted" | "declined";
}) {
    if (status === "accepted") {
        return (<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
        <CheckCircle2 className="h-3 w-3"/>
        Accepted
      </span>);
    }
    if (status === "declined") {
        return (<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800">
        <XCircle className="h-3 w-3"/>
        Declined
      </span>);
    }
    return (<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
      <Clock className="h-3 w-3"/>
      Pending
    </span>);
}
