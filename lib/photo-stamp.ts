import { BUSINESS_TIME_ZONE } from "@/lib/dashboard";
import { locate, type Fix } from "@/lib/evidence";

export { locate };
export type { Fix };
/** What the phone knew when the shutter went: sent with the photo for the server to judge. */
export type Capture = { takenAt: number; fix: Fix };


const stampTime = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: BUSINESS_TIME_ZONE });

/** The text burned onto a site photo: when, where, and what for. */
export function stampLines(at: Date, fix: Fix, taskTitle: string): string[] {
    return [
        stampTime.format(at),
        fix ? `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)} · ±${Math.round(fix.accuracy)} m` : "Location unavailable",
        taskTitle,
    ];
}

// ponytail: 2560 px long side keeps old phones under canvas memory limits; raise it if reviewers need more detail.
const MAX_SIDE = 2560;

/** Redraws the photo with the stamp across the bottom, as a JPEG. */
export async function stampPhoto(file: File, lines: string[]): Promise<File> {
    const url = URL.createObjectURL(file);
    try {
        // An <img> applies the camera's EXIF rotation; createImageBitmap doesn't on older Safari.
        const img = new Image();
        img.src = url;
        await img.decode();
        const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            throw new Error("Canvas unavailable");
        ctx.drawImage(img, 0, 0, w, h);
        const size = Math.max(14, Math.round(Math.min(w, h) / 40));
        const pad = Math.round(size * 0.6), lineH = Math.round(size * 1.3);
        const band = pad * 2 + lineH * lines.length;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, h - band, w, band);
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${size}px system-ui, -apple-system, sans-serif`;
        ctx.textBaseline = "top";
        lines.forEach((t, i) => ctx.fillText(t, pad, h - band + pad + i * lineH, w - pad * 2));
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
        if (!blob)
            throw new Error("Couldn't encode the photo");
        return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`, { type: "image/jpeg" });
    }
    finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * Readies fresh camera media for upload: waits for the location fix started
 * when the camera opened, and stamps photos with when, where and what for.
 * Videos aren't redrawn (the server's record is their proof); a photo that
 * can't be redrawn goes as it is, since it still came from the camera.
 */
export async function prepareSiteMedia(file: File, fix: Promise<Fix>, taskTitle: string): Promise<{ file: File; capture: Capture; stamped: boolean }> {
    const takenAt = Date.now();
    const where = await fix;
    const capture = { takenAt, fix: where };
    if (file.type.startsWith("video/"))
        return { file, capture, stamped: true };
    try {
        return { file: await stampPhoto(file, stampLines(new Date(takenAt), where, taskTitle)), capture, stamped: true };
    }
    catch {
        return { file, capture, stamped: false };
    }
}
