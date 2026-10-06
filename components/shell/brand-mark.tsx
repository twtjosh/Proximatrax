import { cn } from "@/lib/utils";
import { COMPANY_NAME } from "@/lib/vocabulary";

/**
 * The ProximaTrax mark: a progress orbit with the tracked point at its
 * leading edge, the same ring the overview draws for the portfolio.
 */
export function BrandMark({ className }: {
    className?: string;
}) {
    return (<svg viewBox="0 0 24 24" className={cn("size-6 shrink-0", className)} aria-hidden>
      <rect width="24" height="24" rx="6.5" fill="var(--brand)"/>
      <circle cx="12" cy="12" r="6" fill="none" stroke="rgb(255 255 255 / 0.28)" strokeWidth="2"/>
      <path d="M12 6a6 6 0 0 1 5.2 9" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="17.2" cy="15" r="1.9" fill="#FFFFFF"/>
    </svg>);
}

export function BrandLockup({ className }: {
    className?: string;
}) {
    return (<span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <BrandMark className="size-7"/>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[15px] font-semibold tracking-tight text-rail-ink">ProximaTrax</span>
        <span className="block truncate text-xs text-rail-ink-tertiary">{COMPANY_NAME}</span>
      </span>
    </span>);
}
