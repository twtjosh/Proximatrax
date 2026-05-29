export default function ProjectAnalyticsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-stone-100" />
        <div className="h-6 w-48 animate-pulse rounded bg-stone-100" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded bg-stone-100" />
      </div>
      <div className="h-[420px] animate-pulse rounded-2xl border border-stone-200 bg-stone-50" />
    </div>
  );
}
