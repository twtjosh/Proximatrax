import Link from "next/link";
import { primaryAction } from "@/components/dashboard/overview-kit";
import { ROUTES } from "@/lib/constants";

/** A workspace link that leads nowhere: an old link, or a project that was removed. Keep the shell and offer the way home. */
export default function WorkspaceNotFound() {
    return (<div className="mx-auto mt-16 flex w-full max-w-md flex-col items-start gap-3">
      <h1 className="text-lg font-semibold text-ink">This page isn&apos;t here</h1>
      <p className="text-sm leading-relaxed text-ink-secondary">
        The link may be out of date, or the project was removed. Everything else is where you left it.
      </p>
      {/* /dashboard sends crew on to their own home. */}
      <Link href={ROUTES.DASHBOARD} className={primaryAction}>Back to your Overview</Link>
    </div>);
}
