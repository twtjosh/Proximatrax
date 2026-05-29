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
