export type MediaKind = "file" | "photo" | "video";
export function mediaKindFromMime(mimeType: string): MediaKind {
    if (mimeType.startsWith("image/"))
        return "photo";
    if (mimeType.startsWith("video/"))
        return "video";
    return "file";
}
export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
    file: "Files",
    photo: "Photos",
    video: "Videos",
};
// ponytail: mirrors the Supabase Free plan's fixed 50 MB per-file cap; raise it with the project's Storage upload limit.
export const MAX_UPLOAD_MB = 50;
/** Why a file is too big to upload, in words for the person, or null when it fits. */
export function uploadTooBig(file: { size: number; type: string }): string | null {
    const mb = file.size / (1024 * 1024);
    if (mb <= MAX_UPLOAD_MB)
        return null;
    return `${MEDIA_KIND_LABELS[mediaKindFromMime(file.type)]} can be up to ${MAX_UPLOAD_MB} MB. This one is ${mb.toFixed(1)} MB.`;
}
