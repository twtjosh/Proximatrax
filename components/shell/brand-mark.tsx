import { cn } from "@/lib/utils";
import { COMPANY_NAME } from "@/lib/vocabulary";

/**
 * The ProximaTrax logo on a white tile. The logo's navy and white facets
 * would vanish on the midnight rail or a white page, so it always sits on
 * its own tile, like an app icon. Size it with a `size-*` class.
 */
export function BrandMark({ className }: {
    className?: string;
}) {
    return (<span className={cn("inline-grid size-6 shrink-0 place-items-center rounded-[28%] bg-white shadow-[inset_0_0_0_1px_rgb(14_18_34/0.08),0_1px_2px_rgb(0_0_0/0.22)]", className)} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- a 128px static mark; the optimizer adds nothing at this size */}
      <img src="/brand/proximatrax-mark.png" alt="" width={128} height={128} draggable={false} className="size-[94%] object-contain"/>
    </span>);
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
