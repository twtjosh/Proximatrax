"use client";
import "leaflet/dist/leaflet.css";
import * as React from "react";
import type * as Leaflet from "leaflet";
import { SITE_RADIUS_M } from "@/lib/evidence";
import { cn } from "@/lib/utils";

export type LatLng = { lat: number; lng: number };
/** A photo or video on the map: numbered, amber when it was taken off site. */
export type MapPoint = LatLng & { id: string; label: string; active?: boolean; off?: boolean; note?: string };

export const MANILA: LatLng = { lat: 14.5995, lng: 120.9842 };

/** The app's own colours, read at draw time so the map follows light and dark mode. */
const token = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const pinHtml = (color: string) => `<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true"><path d="M14 35s12-11.4 12-21A12 12 0 0 0 2 14c0 9.6 12 21 12 21Z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="4.5" fill="#fff"/></svg>`;
const dotHtml = (label: string, color: string, active: boolean) => `<span style="display:grid;place-items:center;width:26px;height:26px;border-radius:9999px;background:${color};color:#fff;font:600 12px/1 system-ui,sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgb(0 0 0/.35)${active ? `,0 0 0 4px ${color}55` : ""}">${label}</span>`;

/**
 * OpenStreetMap through Leaflet, loaded only when a map is on screen. Draws
 * the site pin with its on-site circle and, for review, each photo's spot.
 * With `onPick`, a tap or a drag of the pin moves the site.
 */
export function SiteMap({ site, points, onPick, center, className, label }: {
    site: LatLng | null;
    points?: MapPoint[];
    onPick?: (p: LatLng) => void;
    /** Moves the view here whenever it changes: a search result, "use my location". */
    center?: (LatLng & { zoom?: number }) | null;
    className?: string;
    label: string;
}) {
    const box = React.useRef<HTMLDivElement>(null);
    const [ready, setReady] = React.useState<{ L: typeof Leaflet; map: Leaflet.Map; layer: Leaflet.LayerGroup } | null>(null);
    const pickRef = React.useRef(onPick);
    const fitted = React.useRef(false);
    React.useEffect(() => {
        pickRef.current = onPick;
    });

    React.useEffect(() => {
        let alive = true;
        let map: Leaflet.Map | null = null;
        let resize: ResizeObserver | null = null;
        void import("leaflet").then((mod) => {
            const L = ((mod as unknown as { default?: typeof Leaflet }).default ?? mod) as typeof Leaflet;
            if (!alive || !box.current)
                return;
            map = L.map(box.current).setView([MANILA.lat, MANILA.lng], 12);
            L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>" }).addTo(map);
            map.on("click", (e: Leaflet.LeafletMouseEvent) => pickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
            // Dialogs size themselves after the map mounts; keep the tiles filling the box.
            resize = new ResizeObserver(() => map?.invalidateSize());
            resize.observe(box.current);
            setReady({ L, map, layer: L.layerGroup().addTo(map) });
        });
        return () => {
            alive = false;
            resize?.disconnect();
            map?.remove();
        };
    }, []);

    React.useEffect(() => {
        if (!ready)
            return;
        const { L, map, layer } = ready;
        layer.clearLayers();
        const brand = token("--brand", "#B45309"), warn = token("--warning", "#935D00"), ok = token("--success", "#12754F");
        const list = points ?? [];
        if (site) {
            L.circle([site.lat, site.lng], { radius: SITE_RADIUS_M, color: brand, weight: 2, fillColor: brand, fillOpacity: 0.1, interactive: false }).addTo(layer);
            const pin = L.marker([site.lat, site.lng], { draggable: !!pickRef.current, title: "Site", icon: L.divIcon({ className: "", html: pinHtml(brand), iconSize: [28, 36], iconAnchor: [14, 34] }) }).addTo(layer);
            pin.on("dragend", () => {
                const p = pin.getLatLng();
                pickRef.current?.({ lat: p.lat, lng: p.lng });
            });
        }
        for (const p of list) {
            if (site && p.off) {
                const line = L.polyline([[site.lat, site.lng], [p.lat, p.lng]], { color: warn, weight: 2, dashArray: "6 6", interactive: false }).addTo(layer);
                if (p.note)
                    line.bindTooltip(p.note, { permanent: true, direction: "center" });
            }
            L.marker([p.lat, p.lng], { title: p.note ?? `Item ${p.label}`, zIndexOffset: p.active ? 1000 : 0, icon: L.divIcon({ className: "", html: dotHtml(p.label, p.off ? warn : ok, !!p.active), iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(layer);
        }
        if (!fitted.current) {
            fitted.current = true;
            const all = [...(site ? [site] : []), ...list];
            if (all.length > 1)
                map.fitBounds(L.latLngBounds(all.map((a) => [a.lat, a.lng] as [number, number])), { padding: [48, 48], maxZoom: 17 });
            else if (all.length === 1)
                map.setView([all[0].lat, all[0].lng], 17);
        }
    }, [ready, site, points]);

    React.useEffect(() => {
        if (ready && center)
            ready.map.setView([center.lat, center.lng], center.zoom ?? 17);
    }, [ready, center]);

    return <div ref={box} role="application" aria-label={label} className={cn("isolate z-0 bg-surface-sunken", className)}/>;
}
