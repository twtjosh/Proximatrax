"use client";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ProjectWorkspaceTab } from "@/lib/project-view-policy";

/** Event the Board listens for to focus quick add. */
export const QUICK_ADD_EVENT = "pm:quick-add";

const KEYS: [string, string][] = [
    ["1 · 2 · 3", "Overview · Board · Schedule"],
    ["R", "Review submissions"],
    ["N", "New task"],
    ["P", "People"],
    [",", "Project settings"],
    ["A · S", "Accept · Send back (in Review)"],
    ["J · K", "Next · previous submission"],
    ["?", "This list"],
];

/**
 * Keyboard shortcuts across a project, for the PM. They stay out of the way
 * while you type in a field or work in a dialog or panel.
 */
export function ProjectShortcuts({ tabs, reviewHref, boardHref, onPeople, onSettings }: {
    tabs: ProjectWorkspaceTab[];
    reviewHref: string;
    boardHref: string;
    onPeople: () => void;
    onSettings: () => void;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [help, setHelp] = React.useState(false);
    React.useEffect(() => {
        function onKey(e: KeyboardEvent) {
            // Review mode has its own keys.
            if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || pathname === reviewHref)
                return;
            const target = e.target as HTMLElement | null;
            if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], dialog"))
                return;
            const key = e.key.toLowerCase();
            const tab = ["1", "2", "3"].indexOf(key);
            if (tab >= 0 && tabs[tab])
                router.push(tabs[tab].href);
            else if (key === "r")
                router.push(reviewHref);
            else if (key === "n") {
                if (pathname === boardHref)
                    window.dispatchEvent(new CustomEvent(QUICK_ADD_EVENT));
                else
                    router.push(`${boardHref}?add=1`);
            }
            else if (key === "p")
                onPeople();
            else if (key === ",")
                onSettings();
            else if (e.key === "?")
                setHelp(true);
            else
                return;
            e.preventDefault();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [tabs, reviewHref, boardHref, pathname, router, onPeople, onSettings]);

    return (<Dialog open={help} onOpenChange={setHelp}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Anywhere in a project, outside a text field.</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-1.5 text-sm">
          {KEYS.map(([k, v]) => (<div key={k} className="flex items-center justify-between gap-4 border-t border-line py-2 first:border-t-0">
              <dt className="text-ink-secondary">{v}</dt>
              <dd><kbd className="rounded-md bg-surface-sunken px-2 py-0.5 font-sans text-xs font-semibold text-ink shadow-[inset_0_-1px_0_rgb(14_18_34/0.12)]">{k}</kbd></dd>
            </div>))}
        </dl>
      </DialogContent>
    </Dialog>);
}
