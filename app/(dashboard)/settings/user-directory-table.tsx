"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { RoleBadge } from "@/components/shared/role-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { deleteUser } from "@/services/auth-service";
import type { Profile } from "@/types/database";
import type { UserRole } from "@/types/enums";
type UserDirectoryTableProps = {
    profiles: Profile[];
    currentUserId: string;
};
const DELETABLE_ROLES: UserRole[] = ["project_manager", "middleman", "client"];
export function UserDirectoryTable({ profiles, currentUserId, }: UserDirectoryTableProps) {
    const router = useRouter();
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [confirmTarget, setConfirmTarget] = useState<Profile | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    function canDelete(profile: Profile) {
        if (profile.id === currentUserId)
            return false;
        return DELETABLE_ROLES.includes(profile.role);
    }
    async function handleConfirmDelete() {
        if (!confirmTarget)
            return;
        setError(null);
        setIsDeleting(true);
        setPendingId(confirmTarget.id);
        try {
            await deleteUser(confirmTarget.id);
            setConfirmTarget(null);
            router.refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Unable to delete account.");
        }
        finally {
            setIsDeleting(false);
            setPendingId(null);
        }
    }
    return (<>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-white text-left">
              <th className="px-6 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                Name
              </th>
              <th className="px-6 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                Role
              </th>
              <th className="px-6 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                Contact
              </th>
              <th className="px-6 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                Joined
              </th>
              <th className="px-6 py-3.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {profiles.map((p) => {
            const deletable = canDelete(p);
            const isSelf = p.id === currentUserId;
            return (<tr key={p.id} className="bg-white transition-colors hover:bg-zinc-50/80">
                  <td className="px-6 py-3.5 font-medium text-zinc-900">
                    {p.full_name || "—"}
                    {isSelf ? (<span className="ml-2 font-normal text-zinc-400">(you)</span>) : null}
                  </td>
                  <td className="px-6 py-3.5">
                    <RoleBadge role={p.role}/>
                  </td>
                  <td className="px-6 py-3.5 text-zinc-600">
                    {p.contact_number || "—"}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-[11px] tabular-nums text-zinc-500">
                    {new Date(p.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                })}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    {deletable ? (<Button type="button" variant="ghost" size="sm" disabled={pendingId === p.id} onClick={() => {
                        setError(null);
                        setConfirmTarget(p);
                    }} className={cn("h-8 gap-1.5 rounded-lg px-2.5 text-xs text-red-700 hover:bg-red-50 hover:text-red-800")}>
                        {pendingId === p.id ? (<Loader2 className="h-3.5 w-3.5 animate-spin"/>) : (<Trash2 className="h-3.5 w-3.5"/>)}
                        Delete
                      </Button>) : (<span className="text-xs text-zinc-400">—</span>)}
                  </td>
                </tr>);
        })}
          </tbody>
        </table>
      </div>

      <Dialog open={confirmTarget !== null} onOpenChange={(open) => {
            if (!open && !isDeleting) {
                setConfirmTarget(null);
                setError(null);
            }
        }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              Permanently remove{" "}
              <span className="font-medium text-zinc-900">
                {confirmTarget?.full_name || "this user"}
              </span>{" "}
              ({confirmTarget ? ROLE_LABELS[confirmTarget.role] : "member"})?
              This revokes their login and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {error ? (<p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>) : null}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isDeleting} onClick={() => {
            setConfirmTarget(null);
            setError(null);
        }}>
              Cancel
            </Button>
            <Button type="button" disabled={isDeleting} onClick={() => void handleConfirmDelete()} className="bg-red-600 text-white hover:bg-red-700">
              {isDeleting ? (<>
                  <Loader2 className="h-4 w-4 animate-spin"/>
                  Deleting…
                </>) : ("Delete account")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>);
}
