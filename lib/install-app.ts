"use client";
import * as React from "react";

/** Chromium's install event; not in the DOM typings. */
type InstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * How this browser can put ProximaTrax on the home screen: "prompt" when our
 * own button can open the install sheet (Chrome, Edge, Samsung Internet),
 * "ios" when the visitor has to use Share › Add to Home Screen themselves
 * (Apple lets no page start an install), null when it is already installed
 * or the browser cannot install.
 */
export type InstallMode = "prompt" | "ios" | null;

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// Listening at import, not on mount: the browser fires this once, and it can land before React hydrates.
if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault(); // our button replaces Chrome's own banner
        deferred = e as InstallPromptEvent;
        emit();
    });
    window.addEventListener("appinstalled", () => {
        deferred = null;
        installed = true;
        emit();
    });
}

function mode(): InstallMode {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (installed || standalone)
        return null;
    if (deferred)
        return "prompt";
    // iPadOS reports itself as a Mac; touch gives it away.
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return ios ? "ios" : null;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useInstallMode(): InstallMode {
    return React.useSyncExternalStore(subscribe, mode, () => null);
}

/** Opens the browser's install sheet. Each event opens it once; the browser sends a fresh one if declined. */
export async function promptInstall(): Promise<boolean> {
    const event = deferred;
    if (!event)
        return false;
    deferred = null;
    emit();
    await event.prompt();
    return (await event.userChoice).outcome === "accepted";
}

/** The steps an iPhone or iPad visitor follows, for a toast or a card. */
export const IOS_STEPS = "Tap Share, then Add to Home Screen.";
