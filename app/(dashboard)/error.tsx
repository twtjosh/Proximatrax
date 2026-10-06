"use client";
import { Button } from "@/components/ui/button";

/** A workspace page failed to load. Keep the shell, say so plainly, offer a retry. */
export default function WorkspaceError({ reset }: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (<div role="alert" className="mx-auto mt-16 flex w-full max-w-md flex-col items-start gap-3">
      <h1 className="text-lg font-semibold text-ink">This page didn&apos;t load</h1>
      <p className="text-sm leading-relaxed text-ink-secondary">
        Your projects and work are safe. The connection may have dropped while the page was loading. Try again, and if it keeps happening, reload the browser.
      </p>
      <Button variant="brand" onClick={reset}>Try again</Button>
    </div>);
}
