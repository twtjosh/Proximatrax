import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
type SuperAdminHeroProps = {
    icon: LucideIcon;
    eyebrow: string;
    title: string;
    description?: string;
    children?: ReactNode;
    className?: string;
};
export function SuperAdminHero({ icon: Icon, eyebrow, title, description, children, className, }: SuperAdminHeroProps) {
    return (<header className={cn("relative overflow-hidden rounded-2xl border border-slate-200/90 bg-linear-to-br from-slate-50 via-white to-slate-100/95 px-6 py-8 text-slate-900 shadow-[0_22px_56px_-18px_rgba(15,23,42,0.12)] ring-1 ring-slate-950/[0.04] sm:px-8 sm:py-10", "dark:border-zinc-800/90 dark:bg-linear-to-br dark:from-zinc-900/95 dark:via-zinc-950 dark:to-[#030712] dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)] dark:ring-white/[0.04]", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_0%_0%,rgba(225,29,72,0.07),transparent_52%),radial-gradient(ellipse_70%_45%_at_100%_100%,rgba(30,41,59,0.06),transparent_48%)] dark:bg-[radial-gradient(ellipse_100%_70%_at_0%_0%,rgba(244,63,94,0.11),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_100%,rgba(59,130,246,0.06),transparent_45%)]" aria-hidden/>
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="flex min-w-0 gap-4 sm:gap-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 shadow-sm sm:h-12 sm:w-12 dark:border-rose-500/30 dark:bg-rose-500/[0.12] dark:text-rose-400 dark:shadow-inner dark:shadow-rose-950/20" aria-hidden>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75}/>
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-rose-700 dark:text-rose-300/85">
              {eyebrow}
            </p>
            <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl md:text-4xl dark:text-white">
              {title}
            </h1>
            {description ? (<p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                {description}
              </p>) : null}
          </div>
        </div>
        {children ? (<div className="flex flex-col gap-3 border-t border-slate-200/90 pt-6 lg:border-t-0 lg:border-l lg:border-slate-200/90 lg:pl-8 lg:pt-0 dark:border-white/[0.06] dark:lg:border-white/[0.06]">
            {children}
          </div>) : null}
      </div>
    </header>);
}
