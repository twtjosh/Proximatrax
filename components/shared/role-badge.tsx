import { cn } from "@/lib/utils";
import { personTitle } from "@/lib/vocabulary";
import type { CrewClassification, UserRole } from "@/types/enums";
type RoleBadgeProps = {
    role: UserRole;
    /** A middleman shows their classification instead of "Middleman". */
    classification?: CrewClassification | null;
    className?: string;
};
/** Roles are identity, not state — rendered neutrally so they never compete with status colour. */
export function RoleBadge({ role, classification, className }: RoleBadgeProps) {
    return (<span className={cn("inline-flex h-5 items-center rounded-sm border border-line px-1.5 text-xs font-medium text-ink-secondary", className)}>
      {personTitle({ role, classification })}
    </span>);
}
