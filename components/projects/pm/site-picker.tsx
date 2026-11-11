"use client";
import * as React from "react";
import { Loader2, MapPin, Navigation, Search, X } from "lucide-react";
import { toast } from "sonner";
import { focusRing, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { SiteMap, type LatLng } from "@/components/projects/shared/site-map";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { locate, parseCoordinates, SITE_RADIUS_M, WEAK_GPS_M } from "@/lib/evidence";
import { placeResults, placeSearchUrl, type Place } from "@/lib/place-search";
import { cn } from "@/lib/utils";

const field = "h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-tertiary hover:border-line-strong focus:border-brand focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none";
const fmt = (p: LatLng | null) => (p ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : "");

/**
 * Where the job is, chosen on a map: search a place, tap or drag the pin,
 * use the phone's location, or paste coordinates. The circle shows how far
 * "on site" reaches. Nothing saves until Save.
 */
export function SitePicker({ open, onOpenChange, initial, onSave }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initial: LatLng | null;
    onSave: (pin: LatLng) => Promise<boolean>;
}) {
    const [pin, setPin] = React.useState<LatLng | null>(initial);
    const [text, setText] = React.useState(fmt(initial));
    const [textError, setTextError] = React.useState(false);
    const [center, setCenter] = React.useState<(LatLng & { zoom?: number }) | null>(null);
    const [query, setQuery] = React.useState("");
    const [results, setResults] = React.useState<Place[] | null>(null);
    const [busy, setBusy] = React.useState<"search" | "here" | "save" | null>(null);

    // Each opening starts from the saved pin. Read through a ref: the parent
    // rebuilds `initial` every render, which would reset the pin mid-pick.
    const initialRef = React.useRef(initial);
    React.useEffect(() => {
        initialRef.current = initial;
    });
    React.useEffect(() => {
        if (!open)
            return;
        const start = initialRef.current;
        setPin(start);
        setText(fmt(start));
        setTextError(false);
        setResults(null);
        setQuery("");
        setCenter(null);
    }, [open]);

    function place(p: LatLng, move: boolean) {
        setPin(p);
        setText(fmt(p));
        setTextError(false);
        if (move)
            setCenter({ ...p, zoom: 17 });
    }

    async function search(e: React.FormEvent) {
        e.preventDefault();
        if (!query.trim() || busy)
            return;
        setBusy("search");
        try {
            const res = await fetch(placeSearchUrl(query.trim()), { headers: { Accept: "application/json" } });
            setResults(placeResults(await res.json()));
        }
        catch {
            setResults(null);
            toast.error("Search isn't available right now. Tap the map or paste coordinates.");
        }
        finally {
            setBusy(null);
        }
    }

    async function here() {
        setBusy("here");
        const fix = await locate();
        setBusy(null);
        if (!fix) {
            toast.error("Couldn't get your location. Allow location access, or search for the place.");
            return;
        }
        place(fix, true);
        if (fix.accuracy > WEAK_GPS_M)
            toast.message(`GPS is weak here (±${Math.round(fix.accuracy)} m). Drag the pin onto the building.`);
    }

    function typed() {
        if (!text.trim())
            return;
        const p = parseCoordinates(text);
        if (!p)
            return setTextError(true);
        place(p, true);
    }

    async function save() {
        if (!pin)
            return;
        setBusy("save");
        const ok = await onSave(pin);
        setBusy(null);
        if (ok)
            onOpenChange(false);
    }

    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="inset-0 top-0 left-0 flex h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(46rem,92dvh)] sm:w-[min(56rem,calc(100%-3rem))] sm:max-w-none sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border">
        <div className="grid gap-3 border-b border-line bg-surface px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[17px]">Pick the site</DialogTitle>
              <DialogDescription className="text-[13px]">Search, tap the map, or drag the pin. Photos inside the circle ({SITE_RADIUS_M} m) count as on site.</DialogDescription>
            </div>
            <DialogClose aria-label="Close" className={cn("press grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-secondary hover:bg-surface-sunken", focusRing)}><X className="size-4" aria-hidden/></DialogClose>
          </div>
          <form onSubmit={(e) => void search(e)} className="relative flex gap-2" role="search">
            <label htmlFor="site-search" className="sr-only">Search for a place</label>
            <input id="site-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a place, e.g. National Teachers College" autoComplete="off" className={field}/>
            <button type="submit" disabled={!query.trim() || busy !== null} className={cn(primaryAction, "h-11 shrink-0")}>{busy === "search" ? <Loader2 className="animate-spin" aria-hidden/> : <Search aria-hidden/>}<span className="max-sm:sr-only">Search</span></button>
            {results ? (<div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-1100 overflow-hidden rounded-2xl border border-line bg-surface shadow-overlay">
                {results.length === 0 ? <p className="px-4 py-3 text-sm text-ink-secondary">No places found. Try a nearby landmark, or tap the map.</p> : (<ul className="max-h-72 overflow-y-auto py-1" aria-label="Search results">
                    {results.map((r) => (<li key={`${r.lat},${r.lng}`}>
                        <button type="button" onClick={() => {
                            place(r, true);
                            setResults(null);
                        }} className={cn("flex w-full cursor-pointer items-start gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-surface-sunken", focusRing)}>
                          <MapPin className="mt-0.5 size-4 shrink-0 text-copper" aria-hidden/><span className="line-clamp-2">{r.name}</span>
                        </button>
                      </li>))}
                  </ul>)}
              </div>) : null}
          </form>
        </div>

        <SiteMap site={pin} onPick={(p) => place(p, false)} center={center} label="Map. Tap to place the site pin." className="min-h-0 flex-1"/>

        <div className="grid gap-2.5 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex sm:items-center sm:px-5">
          <div className="grid min-w-0 flex-1 gap-1">
            <label htmlFor="site-coords" className="sr-only">Site coordinates</label>
            <input id="site-coords" value={text} onChange={(e) => {
                setText(e.target.value);
                setTextError(false);
            }} onBlur={typed} onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    typed();
                }
            }} placeholder="Coordinates, e.g. 14.59950, 120.98420" inputMode="decimal" autoComplete="off" aria-invalid={textError} className={cn(field, "tabular", textError && "border-danger")}/>
            {textError ? <p className="text-xs text-danger" role="alert">Use coordinates like 14.59950, 120.98420.</p> : null}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy !== null} onClick={() => void here()} className={cn(softAction, "h-11 flex-1 justify-center px-4 text-sm sm:flex-none")}>{busy === "here" ? <Loader2 className="animate-spin" aria-hidden/> : <Navigation aria-hidden/>}My location</button>
            <button type="button" disabled={!pin || busy !== null} onClick={() => void save()} className={cn(primaryAction, "h-11 flex-1 justify-center sm:flex-none")}>{busy === "save" ? <Loader2 className="animate-spin" aria-hidden/> : null}Save site</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>);
}
