import { cn } from "@/lib/utils";
import { PROJECT_STATUS_TERMS, type StatusTone } from "@/lib/vocabulary";
import type { ProjectStatus } from "@/types/enums";

const TONE_CLASSES: Record<StatusTone, { badge: string; dot: string }> = {
    neutral: { badge: "bg-neutral-soft text-neutral", dot: "bg-ink-tertiary" },
    info: { badge: "bg-info-soft text-info", dot: "bg-info" },
    warning: { badge: "bg-warning-soft text-warning", dot: "bg-warning" },
    success: { badge: "bg-success-soft text-success", dot: "bg-success" },
    danger: { badge: "bg-danger-soft text-danger", dot: "bg-danger" },
};

export function toneDotClass(tone: StatusTone) {
    return TONE_CLASSES[tone].dot;
}

type StatusBadgeProps = {
    tone: StatusTone;
    children: React.ReactNode;
    className?: string;
};

/** A workflow state. Colour always comes from the tone, never ad hoc. */
export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
    return (<span className={cn("inline-flex h-5 shrink-0 items-center gap-1.5 rounded-sm px-1.5 text-xs font-medium whitespace-nowrap", TONE_CLASSES[tone].badge, className)}>
      <span className={cn("size-1.5 rounded-full", TONE_CLASSES[tone].dot)} aria-hidden/>
      {children}
    </span>);
}

export function ProjectStatusBadge({ status, className }: {
    status: ProjectStatus;
    className?: string;
}) {
    const term = PROJECT_STATUS_TERMS[status];
    return <StatusBadge tone={term.tone} className={className}>{term.label}</StatusBadge>;
}
