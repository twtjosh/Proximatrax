"use client";
import * as React from "react";
import { ExternalLink, MapPinOff } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import { chromeIntentUrl, inAppBrowser } from "@/lib/in-app-browser";
import { cn } from "@/lib/utils";

const noop = () => () => undefined;

/**
 * Shown when a task was opened from Messenger, Facebook or Instagram: their
 * built-in browser refuses location without asking, so every photo would be
 * flagged "No location". Android gets a one-tap way out to Chrome.
 */
export function InAppBrowserNotice({ className }: { className?: string }) {
    const ua = React.useSyncExternalStore(noop, () => navigator.userAgent, () => "");
    const href = React.useSyncExternalStore(noop, () => window.location.href, () => "");
    const inApp = inAppBrowser(ua);
    if (!inApp)
        return null;
    return (<div role="status" className={cn("flex items-start gap-3 rounded-2xl bg-warning-soft px-4 py-3 text-[13px] leading-relaxed text-warning", className)}>
      <MapPinOff className="mt-0.5 size-4 shrink-0" aria-hidden/>
      <div className="grid min-w-0 flex-1 gap-2">
        <p><b className="font-semibold">Open this in {inApp.android ? "Chrome" : "Safari"}.</b> You opened it from Messenger or Facebook, whose browser blocks location, so your photos would be flagged &ldquo;No location&rdquo;.</p>
        {inApp.android && href ? (<a href={chromeIntentUrl(href)} className={cn("press inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-warning px-3.5 text-[13px] font-semibold text-white", focusRing)}><ExternalLink className="size-3.5" aria-hidden/>Open in Chrome</a>) : (<p>Tap the <b className="font-semibold">•••</b> menu, then <b className="font-semibold">Open in browser</b>.</p>)}
      </div>
    </div>);
}
