import { AlertTriangle, ExternalLink, Scale, Sparkles } from "lucide-react";

import {
  formatPhp,
  getMockClientMarketInsight,
  type MarketVerdict,
  type MockClientMarketInsight,
} from "@/lib/mock/predictive-analytics-mock";
import { cn } from "@/lib/utils";

function VerdictBadge({ verdict, label }: { verdict: MarketVerdict; label: string }) {
  const styles: Record<MarketVerdict, string> = {
    good_deal:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    fair:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
    above_market:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        styles[verdict]
      )}
    >
      <Scale className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </span>
  );
}

function MarketRangeBar({
  low,
  mid,
  high,
  value,
}: {
  low: number;
  mid: number;
  high: number;
  value: number;
}) {
  const span = high - low;
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  const valuePct = clamp(((value - low) / span) * 100);
  const midPct = clamp(((mid - low) / span) * 100);

  return (
    <div className="space-y-2">
      <div className="relative h-3 overflow-hidden rounded-full bg-stone-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-amber-200 via-amber-300 to-amber-200"
          style={{ left: "0%", right: "0%" }}
          aria-hidden
        />
        <div
          className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-stone-500/70"
          style={{ left: `${midPct}%` }}
          aria-hidden
        />
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-stone-900 shadow-md"
          style={{ left: `${valuePct}%` }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-stone-500">
        <span>{formatPhp(low, true)} low</span>
        <span>{formatPhp(mid, true)} mid</span>
        <span>{formatPhp(high, true)} high</span>
      </div>
    </div>
  );
}

export function ClientMarketInsightPanel({
  projectTitle,
  insight: insightOverride,
}: {
  projectTitle?: string;
  insight?: MockClientMarketInsight;
}) {
  const insight = insightOverride ?? getMockClientMarketInsight(projectTitle);
  const clientPerSqm = Math.round(insight.contractValue / insight.floorAreaSqm);
  const marketPerSqm = Math.round(insight.marketMid / insight.floorAreaSqm);

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm">
      <div className="border-b border-stone-100 bg-linear-to-r from-stone-50 to-amber-50/40 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-200/80 bg-white shadow-sm">
              <Sparkles className="h-4 w-4 text-amber-800" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800/80">
                Market price insight
              </p>
              <h3 className="mt-0.5 font-heading text-base font-semibold tracking-tight text-stone-900">
                How your price compares
              </h3>
              <p className="mt-1 text-sm text-stone-600">{insight.projectTitle}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-800">
            <AlertTriangle className="h-2.5 w-2.5" />
            Prototype
          </span>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
              Your project value
            </p>
            <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-stone-900">
              {formatPhp(insight.contractValue)}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              ≈ {formatPhp(clientPerSqm)} / sqm · {insight.floorAreaSqm} sqm
            </p>
          </div>
          <VerdictBadge verdict={insight.verdict} label={insight.verdictLabel} />
        </div>

        <div className="rounded-xl border border-stone-100 bg-stone-50/60 p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Typical market range · {insight.location}
          </p>
          <MarketRangeBar
            low={insight.marketLow}
            mid={insight.marketMid}
            high={insight.marketHigh}
            value={insight.contractValue}
          />
          <p className="mt-3 text-xs leading-relaxed text-stone-600">
            Market midpoint ≈ {formatPhp(marketPerSqm)} / sqm for{" "}
            <span className="font-medium text-stone-800">{insight.projectType}</span>
          </p>
        </div>

        <p className="text-sm leading-relaxed text-stone-700">{insight.summary}</p>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-stone-100 px-3 py-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
              Model confidence
            </dt>
            <dd className="mt-1 font-heading text-lg font-semibold tabular-nums text-stone-900">
              {insight.confidencePct}%
            </dd>
          </div>
          <div className="rounded-lg border border-stone-100 px-3 py-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
              vs market midpoint
            </dt>
            <dd className="mt-1 font-heading text-lg font-semibold tabular-nums text-stone-900">
              {insight.contractValue >= insight.marketMid ? "+" : "−"}
              {formatPhp(Math.abs(insight.contractValue - insight.marketMid), true)}
            </dd>
          </div>
        </dl>

        {insight.sources.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
              Reference sources (mock)
            </p>
            <ul className="mt-2 space-y-1.5">
              {insight.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-900"
                  >
                    {source.title}
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
