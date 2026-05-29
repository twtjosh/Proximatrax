import {
  AlertTriangle,
  CircleDollarSign,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  formatPhp,
  MOCK_PORTFOLIO_SUMMARY,
  MOCK_PROJECT_PROFIT_OUTLOOK,
  type MockProjectProfitOutlook,
  type ProfitOutlookStatus,
} from "@/lib/mock/predictive-analytics-mock";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: ProfitOutlookStatus }) {
  const config: Record<
    ProfitOutlookStatus,
    { label: string; className: string; icon: typeof TrendingUp }
  > = {
    profit: {
      label: "Profit likely",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
      icon: TrendingUp,
    },
    break_even: {
      label: "Break-even",
      className:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
      icon: CircleDollarSign,
    },
    loss: {
      label: "Loss likely",
      className:
        "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
      icon: TrendingDown,
    },
  };

  const { label, className, icon: Icon } = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        className
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.25} />
      {label}
    </span>
  );
}

function SummaryTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "success" | "danger" | "neutral";
}) {
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/60">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1 font-heading text-xl font-semibold tabular-nums leading-none",
          tone === "success" && "text-emerald-600",
          tone === "danger" && "text-red-600",
          !tone && "text-slate-950 dark:text-white"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}

function ProjectRow({ project }: { project: MockProjectProfitOutlook }) {
  const isLoss = project.predictedProfit < 0;

  return (
    <tr className="border-t border-slate-100 dark:border-zinc-800/80">
      <td className="px-3 py-2.5">
        <p className="text-sm font-medium text-slate-900 dark:text-white">{project.title}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          Model confidence · {project.confidencePct}%
        </p>
      </td>
      <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-slate-700 dark:text-zinc-300 sm:table-cell">
        {formatPhp(project.contractValue, true)}
      </td>
      <td className="hidden px-3 py-2.5 text-right text-sm tabular-nums text-slate-700 dark:text-zinc-300 md:table-cell">
        {formatPhp(project.estimatedCost, true)}
      </td>
      <td className="px-3 py-2.5 text-right">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            isLoss ? "text-red-600" : "text-emerald-600"
          )}
        >
          {isLoss ? "−" : "+"}
          {formatPhp(Math.abs(project.predictedProfit), true)}
        </p>
        <p className="text-[10px] tabular-nums text-slate-500">{project.marginPct}% margin</p>
      </td>
      <td className="px-3 py-2.5 text-right">
        <StatusBadge status={project.status} />
      </td>
    </tr>
  );
}

export function ProjectProfitOutlook() {
  const summary = MOCK_PORTFOLIO_SUMMARY;
  const totalTone = summary.totalPredictedProfit >= 0 ? "success" : "danger";

  return (
    <section className="rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm ring-1 ring-slate-950/3 sm:p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#1e3a5f]/15 bg-[#1e3a5f]/5 dark:border-slate-600 dark:bg-slate-800/60">
              <Sparkles className="h-3.5 w-3.5 text-[#1e3a5f] dark:text-slate-300" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-heading text-sm font-semibold tracking-tight text-slate-950 dark:text-white">
                Project profit outlook
              </h2>
              <p className="text-[10px] text-slate-500">
                Predictive analytics · per-project profit or loss forecast
              </p>
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300">
          <AlertTriangle className="h-2.5 w-2.5" />
          Prototype · mock data
        </span>
      </div>

      <div className="mb-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          label="Profitable projects"
          value={String(summary.profitableCount)}
          detail="Forecast margin above threshold"
          tone="success"
        />
        <SummaryTile
          label="Loss risk"
          value={String(summary.atRiskCount)}
          detail="Estimated cost exceeds contract"
          tone="danger"
        />
        <SummaryTile
          label="Break-even"
          value={String(summary.breakEvenCount)}
          detail="Thin margin · monitor closely"
        />
        <SummaryTile
          label="Total predicted P/L"
          value={`${summary.totalPredictedProfit >= 0 ? "+" : "−"}${formatPhp(Math.abs(summary.totalPredictedProfit), true)}`}
          detail="Across active engagements"
          tone={totalTone}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200/90 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead className="bg-slate-50/80 dark:bg-zinc-900/50">
              <tr>
                <th className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                  Project
                </th>
                <th className="hidden px-3 py-2 text-right text-[9px] font-semibold uppercase tracking-wide text-slate-500 sm:table-cell">
                  Contract
                </th>
                <th className="hidden px-3 py-2 text-right text-[9px] font-semibold uppercase tracking-wide text-slate-500 md:table-cell">
                  Est. cost
                </th>
                <th className="px-3 py-2 text-right text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                  Predicted P/L
                </th>
                <th className="px-3 py-2 text-right text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                  Outlook
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-950/20">
              {MOCK_PROJECT_PROFIT_OUTLOOK.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
        Forecasts compare agreed contract value against internal cost estimates. Values shown are
        illustrative only — live bidding and estimation data will replace this mock when the feature
        is connected.
      </p>
    </section>
  );
}
