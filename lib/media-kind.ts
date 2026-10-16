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
/** A task can go for review once it has a photo or a video of the work; a PDF alone isn't proof. */
export function hasSiteEvidence(attachments: { media_kind: string }[]): boolean {
    return attachments.some((a) => a.media_kind === "photo" || a.media_kind === "video");
}
/** "2 photos · 1 video"; other files are left out. */
export function mediaCountPhrase(attachments: { media_kind: string }[]): string {
    const n = (kind: string) => attachments.filter((a) => a.media_kind === kind).length;
    const photos = n("photo"), videos = n("video");
    const parts = [photos ? `${photos} ${photos === 1 ? "photo" : "photos"}` : "", videos ? `${videos} ${videos === 1 ? "video" : "videos"}` : ""].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "No photos or videos";
}
