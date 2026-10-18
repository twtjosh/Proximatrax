"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { RoleBadge } from "@/components/shared/role-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
const selectClass = "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400/25";
export function UserDirectoryTable({ profiles, currentUserId, }: UserDirectoryTableProps) {
    const router = useRouter();
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [confirmTarget, setConfirmTarget] = useState<Profile | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    // Set once the server says this PM still manages projects; a successor must be picked.
    const [needsReassign, setNeedsReassign] = useState(false);
    const [reassignTo, setReassignTo] = useState("");
    const successors = profiles.filter((p) => p.role === "project_manager" && p.id !== confirmTarget?.id);
    function closeDialog() {
        setConfirmTarget(null);
        setError(null);
        setNeedsReassign(false);
        setReassignTo("");
    }
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
            await deleteUser(confirmTarget.id, needsReassign ? reassignTo : undefined);
            closeDialog();
            router.refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Unable to delete account.");
            if ((err as {
                reassignable?: boolean;
            }).reassignable)
                setNeedsReassign(true);
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
                        closeDialog();
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
            if (!open && !isDeleting)
                closeDialog();
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

          {error ? (<p className={cn("rounded-lg border px-3 py-2 text-sm", needsReassign ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800")}>
              {error}
            </p>) : null}

          {needsReassign ? (successors.length > 0 ? (<div className="space-y-2">
                <Label htmlFor="reassign-pm" className="text-zinc-700">
                  Hand their projects to
                </Label>
                <select id="reassign-pm" value={reassignTo} disabled={isDeleting} onChange={(e) => setReassignTo(e.target.value)} className={selectClass}>
                  <option value="" disabled>
                    Choose a project manager…
                  </option>
                  {successors.map((pm) => (<option key={pm.id} value={pm.id}>
                      {pm.full_name || "Unnamed project manager"}
                    </option>))}
                </select>
              </div>) : (<p className="text-sm text-zinc-600">
                There&apos;s no other project manager to take over. Create one first, then try again.
              </p>)) : null}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isDeleting} onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="button" disabled={isDeleting || (needsReassign && !reassignTo)} onClick={() => void handleConfirmDelete()} className="bg-red-600 text-white hover:bg-red-700">
              {isDeleting ? (<>
                  <Loader2 className="h-4 w-4 animate-spin"/>
                  Deleting…
                </>) : needsReassign ? ("Reassign & delete") : ("Delete account")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>);
}
