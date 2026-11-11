/**
 * Place search for the site picker, through OpenStreetMap's free Nominatim
 * service. Its usage policy allows no search-as-you-type, so the picker
 * searches only when the PM presses Search.
 */
export type Place = { lat: number; lng: number; name: string };

export function placeSearchUrl(query: string): string {
    const u = new URL("https://nominatim.openstreetmap.org/search");
    u.searchParams.set("q", query);
    u.searchParams.set("format", "jsonv2");
    // ponytail: Philippine projects only; drop countrycodes if work goes abroad.
    u.searchParams.set("countrycodes", "ph");
    u.searchParams.set("limit", "5");
    u.searchParams.set("accept-language", "en");
    return u.toString();
}

/** The places in a Nominatim reply that are actually on the map. */
export function placeResults(json: unknown): Place[] {
    if (!Array.isArray(json))
        return [];
    return json.flatMap((r) => {
        const lat = Number(r?.lat), lng = Number(r?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
            return [];
        return [{ lat, lng, name: String(r?.display_name ?? "") }];
    });
}
