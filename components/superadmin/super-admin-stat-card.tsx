import { cn } from "@/lib/utils";
export function SuperAdminStatCard({ label, value, hint, }: {
    label: string;
    value: number;
    hint?: string;
}) {
    return (<div className={cn("relative overflow-hidden rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-950/[0.03] dark:border-zinc-800/90 dark:bg-zinc-950/50 dark:ring-white/[0.03]", "cursor-default select-none")}>
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-500">
        {label}
      </p>
      <p className="mt-3 font-heading text-3xl font-semibold tabular-nums tracking-tight text-slate-950 dark:text-white">
        {value}
      </p>
      {hint ? (<p className="mt-2 text-xs leading-snug text-slate-500 dark:text-zinc-500">
          {hint}
        </p>) : null}
    </div>);
}
