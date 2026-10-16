import { uploadTooBig } from "./media-kind.ts";

/**
 * Wording and sums for the tray where picked files wait before they upload.
 * Pure, so `node --test` can run it.
 */

export type TrayStatus = "ready" | "uploading" | "done" | "failed";

export function formatSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "0:42", "1:05", "1:02:03"; null when the length isn't known yet. */
export function formatDuration(seconds: number): string | null {
    if (!Number.isFinite(seconds))
        return null;
    const s = Math.round(seconds), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = String(s % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** What the Upload button would send now (ready or failed, within the size limit), and what can't go at all. */
export function traySummary(items: { size: number; type: string; status: TrayStatus }[]) {
    const open = items.filter((i) => i.status === "ready" || i.status === "failed");
    const sendable = open.filter((i) => !uploadTooBig(i));
    const bytes = sendable.reduce((s, i) => s + i.size, 0);
    return {
        sendable: sendable.length,
        bytes,
        tooBig: open.length - sendable.length,
        text: sendable.length > 0 ? `${sendable.length} ready · ${formatSize(bytes)}` : "",
    };
}
