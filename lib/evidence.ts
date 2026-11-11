/**
 * The rules for site-photo evidence: how far from the site, how good the GPS,
 * whether the phone's clock can be trusted. Pure, so `node --test` runs it and
 * the server route and the review card agree on one set of thresholds.
 */

export type Fix = { lat: number; lng: number; accuracy: number } | null;
export type Site = { lat: number; lng: number } | null;
export type EvidenceFlag = "no_location" | "weak_gps" | "off_site" | "no_site" | "clock_mismatch";

export const SITE_RADIUS_M = 200;
export const WEAK_GPS_M = 100;
export const CLOCK_SKEW_MS = 120_000;
/** Vercel caps a request body at 4.5 MB; photos are downscaled well below this. */
export const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

const inRange = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/**
 * Judges one photo. Only the server's clock is trusted for "when": the phone
 * contributes just the seconds between shutter and send.
 */
export function assessEvidence(i: { serverNow: number; deviceNow: number; deviceTakenAt: number; fix: Fix; site: Site }): { takenAt: string; distanceM: number | null; flags: EvidenceFlag[] } {
    const flags: EvidenceFlag[] = [];
    if (Math.abs(i.deviceNow - i.serverNow) > CLOCK_SKEW_MS)
        flags.push("clock_mismatch");
    let distanceM: number | null = null;
    if (!i.fix)
        flags.push("no_location");
    else {
        if (i.fix.accuracy > WEAK_GPS_M)
            flags.push("weak_gps");
        if (!i.site)
            flags.push("no_site");
        else {
            distanceM = distanceMeters(i.fix, i.site);
            if (distanceM > SITE_RADIUS_M)
                flags.push("off_site");
        }
    }
    return { takenAt: new Date(i.serverNow - Math.max(0, i.deviceNow - i.deviceTakenAt)).toISOString(), distanceM, flags };
}

const PAIR = String.raw`(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)`;
/** The whole text is a pair, or a Maps link names one after "@" or "q="; an address never matches. */
const COORDINATES = new RegExp(String.raw`^\s*${PAIR}\s*$|[@=]${PAIR}`);

/** "14.5995, 120.9842" or a Google Maps link with "@lat,lng" or "q=lat,lng"; null otherwise. */
export function parseCoordinates(text: string): { lat: number; lng: number } | null {
    const hit = COORDINATES.exec(text);
    const m = hit && (hit[1] !== undefined ? [hit[0], hit[1], hit[2]] : [hit[0], hit[3], hit[4]]);
    if (!m)
        return null;
    const lat = Number(m[1]), lng = Number(m[2]);
    return inRange(lat, lng) ? { lat, lng } : null;
}

/** The server's reading of the form fields a phone sent; null unless all three make sense. */
export function validFix(lat: unknown, lng: unknown, accuracy: unknown): Fix {
    if ([lat, lng, accuracy].some((v) => v === null || v === undefined || v === ""))
        return null;
    const la = Number(lat), ln = Number(lng), acc = Number(accuracy);
    return inRange(la, ln) && Number.isFinite(acc) && acc > 0 ? { lat: la, lng: ln, accuracy: acc } : null;
}

const away = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

/** What the PM reads on a photo: one green chip when all is well, an amber one per problem. */
export function evidenceChips(row: { verified_capture: boolean; site_distance_m: number | null; accuracy_m: number | null; evidence_flags: string[] }): { tone: "ok" | "warn" | "muted"; text: string }[] {
    if (!row.verified_capture)
        return [{ tone: "muted", text: "Not verified (older upload or added by the PM)" }];
    if (row.evidence_flags.length === 0)
        return [{ tone: "ok", text: `On site · ${Math.round(row.site_distance_m ?? 0)} m` }];
    const text: Record<string, string> = {
        clock_mismatch: "Phone clock was off",
        no_location: "No location",
        weak_gps: `Weak GPS (±${Math.round(row.accuracy_m ?? 0)} m)`,
        no_site: "Site location not set",
        off_site: `${away(row.site_distance_m ?? 0)} from site`,
    };
    return row.evidence_flags.filter((f) => f in text).map((f) => ({ tone: "warn" as const, text: text[f] }));
}

/**
 * Where the phone is right now; null when location is denied, off or too slow.
 * The browser's own timeout doesn't count time spent on the permission
 * prompt, so a prompt nobody answers would hang forever: this caps it.
 */
export function locate(timeoutMs = 15_000): Promise<Fix> {
    return new Promise((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation)
            return resolve(null);
        setTimeout(() => resolve(null), timeoutMs);
        navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }), () => resolve(null), { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 });
    });
}

const TOO_LARGE = "Photo is too large. Take it again.";
/**
 * Why a site photo can't go, or didn't: too big before sending, Vercel's own
 * 413 page (which isn't JSON), or the server's message. Null when it can go.
 */
export function evidenceUploadError(file: { size: number }, status?: number, body?: { error?: string } | null): string | null {
    if (status === undefined)
        return file.size > MAX_EVIDENCE_BYTES ? TOO_LARGE : null;
    if (status === 413)
        return TOO_LARGE;
    return body?.error ?? "The photo didn't save. Check your signal and try again.";
}

/** Site videos: short, so they upload on site signal and stay under the bucket's cap. */
export const MAX_VIDEO_SECONDS = 30;
// ponytail: mirrors the Supabase Free plan's 50 MB per-file cap (see MAX_UPLOAD_MB); raise both together.
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const videoTooBig = (bytes: number) => bytes > MAX_VIDEO_BYTES;

/** The container a phone recorded in, as a file extension; null for anything else. */
export function videoExtension(mime: string): "mp4" | "webm" | null {
    const base = mime.split(";")[0].trim();
    return base === "video/mp4" ? "mp4" : base === "video/webm" ? "webm" : null;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** Where the server lets a phone upload one site video. */
export const issuedVideoPath = (projectId: string, taskId: string, id: string, ext: "mp4" | "webm") => `${projectId}/${taskId}/${id}-site-video.${ext}`;
/** True only for a path shaped like one the server issued for this task, so "finish" can't adopt any other file. */
export function isIssuedVideoPath(path: string, projectId: string, taskId: string): boolean {
    return new RegExp(`^${projectId}/${taskId}/${UUID}-site-video\\.(mp4|webm)$`).test(path);
}

/** A plain Google Maps link; no key, no embed. */
export const mapLink = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;
