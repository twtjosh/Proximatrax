import { cn } from "@/lib/utils";
import { ROLE_TERMS } from "@/lib/vocabulary";
import type { UserRole } from "@/types/enums";
type RoleBadgeProps = {
    role: UserRole;
    className?: string;
};
/** Roles are identity, not state — rendered neutrally so they never compete with status colour. */
export function RoleBadge({ role, className }: RoleBadgeProps) {
    return (<span className={cn("inline-flex h-5 items-center rounded-sm border border-line px-1.5 text-xs font-medium text-ink-secondary", className)}>
      {ROLE_TERMS[role]}
    </span>);
}
