import { ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/enums";
const roleClasses: Record<UserRole, string> = {
    super_admin: "border-red-300/40 bg-red-500/10 text-red-700",
    project_manager: "border-copper/30 bg-copper-soft text-copper-hover",
    middleman: "border-emerald-300/50 bg-emerald-500/10 text-emerald-700",
    client: "border-slate-300 bg-slate-100 text-slate-700",
};
type RoleBadgeProps = {
    role: UserRole;
    className?: string;
};
export function RoleBadge({ role, className }: RoleBadgeProps) {
    return (<span className={cn("inline-flex items-center border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]", roleClasses[role], className)}>
      {ROLE_LABELS[role]}
    </span>);
}
