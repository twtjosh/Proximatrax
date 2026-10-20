"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, MoreHorizontal, Phone, Search, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { Face, focusRing, softAction, stagger } from "@/components/dashboard/overview-kit";
import { RoleBadge } from "@/components/shared/role-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { formatDate, plural } from "@/lib/dashboard";
import { CLASSIFICATION_TERMS, personTitle } from "@/lib/vocabulary";
import { cn } from "@/lib/utils";
import { deleteUser, setClassification } from "@/services/auth-service";
import type { Profile } from "@/types/database";
import type { CrewClassification, UserRole } from "@/types/enums";
import { AddPersonDialog } from "./add-person-dialog";

export type Person = Profile & {
    /** Projects not yet completed that they take part in, in any role. */
    activeProjects: number;
    /** Projects of any status they manage; removing them needs a successor. */
    managed: number;
    /** Projects of any status where they are the client; these block removal. */
    clientOf: number;
};
type Group = UserRole | "all";
const GROUPS: Array<{ value: Group; label: string }> = [
    { value: "all", label: "Everyone" },
    { value: "project_manager", label: "Project managers" },
    { value: "middleman", label: "Middlemen" },
    { value: "client", label: "Clients" },
];
const REMOVABLE: UserRole[] = ["project_manager", "middleman", "client"];
const joined = (iso: string) => formatDate(iso.slice(0, 10), { month: "short", day: "numeric", year: "numeric" });

export function PeopleDirectory({ people, currentUserId }: {
    people: Person[];
    currentUserId: string;
}) {
    const router = useRouter();
    const [group, setGroup] = React.useState<Group>("all");
    const [query, setQuery] = React.useState("");
    const [fresh, setFresh] = React.useState<string | null>(null);
    const [removing, setRemoving] = React.useState<Person | null>(null);
    const [removeOpen, setRemoveOpen] = React.useState(false);
    const searchRef = React.useRef<HTMLInputElement>(null);

    const counts = React.useMemo(() => {
        const c: Record<Group, number> = { all: people.length, project_manager: 0, middleman: 0, client: 0, super_admin: 0 };
        for (const p of people)
            c[p.role]++;
        return c;
    }, [people]);
    const q = query.trim().toLowerCase();
    const shown = people.filter((p) => (group === "all" || p.role === group) &&
        (!q || p.full_name.toLowerCase().includes(q) || (p.contact_number ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, ""))));

    // A person just added arrives with the refresh; bring them into view once.
    React.useEffect(() => {
        if (fresh && people.some((p) => p.id === fresh))
            document.getElementById(`person-${fresh}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [fresh, people]);

    function onCreated(id: string | undefined) {
        setGroup("all");
        setQuery("");
        setFresh(id ?? null);
        router.refresh();
    }

    return (<div className="mx-auto w-full max-w-360 pb-12">
      <header className="materialize flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <h1 className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-ink sm:text-[2.5rem]">People</h1>
          <p className="mt-2 text-[15px] text-ink-tertiary [&_b]:font-medium [&_b]:text-ink">
            <b>{plural(people.length, "account")}</b> · {plural(counts.project_manager, "project manager")}, {counts.middleman} {counts.middleman === 1 ? "middleman" : "middlemen"}, {plural(counts.client, "client")}
          </p>
        </div>
        <AddPersonDialog onCreated={onCreated}/>
      </header>

      <section aria-label="Directory" className="materialize mt-7 rounded-[20px] material" style={stagger(1)}>
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4 md:flex-row md:items-center md:justify-between">
          <div role="radiogroup" aria-label="Show" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
            {GROUPS.map((g) => {
            const on = group === g.value;
            return (<button key={g.value} type="button" role="radio" aria-checked={on} onClick={() => setGroup(g.value)} className={cn("press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-colors", focusRing, on ? "bg-ink text-white" : "text-ink-secondary hover:bg-surface-sunken hover:text-ink")}>
                  {g.label}
                  <span className={cn("tabular text-[12px]", on ? "text-white/65" : "text-ink-tertiary")}>{counts[g.value]}</span>
                </button>);
        })}
          </div>
          <label className="relative block md:w-72">
            <span className="sr-only">Search people</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-tertiary" aria-hidden/>
            <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or phone" className="h-10 w-full rounded-full border-0 bg-surface-sunken pr-9 pl-9 text-sm text-ink transition-shadow outline-none placeholder:text-ink-tertiary focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-brand/40 [&::-webkit-search-cancel-button]:hidden"/>
            {query ? (<button type="button" onClick={() => { setQuery(""); searchRef.current?.focus(); }} aria-label="Clear search" className={cn("absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-tertiary hover:bg-line hover:text-ink", focusRing)}>
                <X className="size-3.5" aria-hidden/>
              </button>) : null}
          </label>
        </div>

        {shown.length === 0 ? (<div className="px-6 py-16 text-center">
            <p className="text-[15px] font-medium text-ink">{q ? `No one matches “${query.trim()}”` : `No ${GROUPS.find((g) => g.value === group)!.label.toLowerCase()} yet`}</p>
            {q || group !== "all" ? <button type="button" onClick={() => { setQuery(""); setGroup("all"); }} className={cn("mx-auto mt-3", softAction)}>Show everyone</button> : null}
          </div>) : (<>
            <div className="hidden grid-cols-[minmax(0,1.6fr)_9.5rem_minmax(0,1fr)_minmax(0,1fr)_2.25rem] gap-x-6 px-6 pt-3 pb-2 text-[12px] font-medium text-ink-tertiary md:grid" aria-hidden>
              <span>Name</span>
              <span>Role</span>
              <span>Projects</span>
              <span>Phone</span>
              <span/>
            </div>
            <ul className="pb-2">
              {shown.map((p) => {
                const isSelf = p.id === currentUserId;
                const projects = p.activeProjects > 0 ? plural(p.activeProjects, "active project") : "No active projects";
                return (<li key={p.id} id={`person-${p.id}`} className={cn("mx-2 grid grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-x-4 rounded-[14px] px-3 py-3 transition-colors hover:bg-surface-subtle md:grid-cols-[minmax(0,1.6fr)_9.5rem_minmax(0,1fr)_minmax(0,1fr)_2.25rem] md:gap-x-6 md:px-4", p.id === fresh && "live-flash")}>
                    <span className="flex min-w-0 items-center gap-3">
                      <Face person={{ id: p.id, name: p.full_name || "?", avatarUrl: p.avatar_url, role: "" }} size={38}/>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[14.5px] font-semibold text-ink">{p.full_name || "Unnamed"}</span>
                          {isSelf ? <span className="shrink-0 rounded-full bg-surface-sunken px-1.5 text-[11px] leading-[18px] font-medium text-ink-secondary">You</span> : null}
                          {p.id === fresh ? <span className="shrink-0 rounded-full bg-brand-soft px-1.5 text-[11px] leading-[18px] font-medium text-brand">New</span> : null}
                        </span>
                        <span className="block truncate text-[12.5px] text-ink-tertiary">
                          <span className="md:hidden">{personTitle(p)} · {projects}</span>
                          <span className="hidden md:inline">Joined {joined(p.created_at)}</span>
                        </span>
                      </span>
                    </span>
                    <span className="hidden md:block">
                      <RoleBadge role={p.role} classification={p.classification}/>
                      {p.role === "middleman" && !p.classification ? <span className="mt-0.5 block text-[11.5px] text-warning">No classification yet</span> : null}
                    </span>
                    <span className={cn("hidden text-[13px] md:block", p.activeProjects > 0 ? "text-ink" : "text-ink-tertiary")}>{projects}</span>
                    <span className="hidden min-w-0 md:block">
                      {p.contact_number
                        ? <a href={`tel:${p.contact_number.replace(/\s/g, "")}`} className={cn("truncate rounded-sm text-[13px] text-ink-secondary tabular hover:text-ink", focusRing)}>{p.contact_number}</a>
                        : <span className="text-[13px] text-ink-tertiary">—</span>}
                    </span>
                    <PersonMenu person={p} removable={!isSelf && REMOVABLE.includes(p.role)} onRemove={() => { setRemoving(p); setRemoveOpen(true); }}/>
                  </li>);
            })}
            </ul>
          </>)}
      </section>

      <RemoveDialog person={removing} open={removeOpen} people={people} onClose={() => setRemoveOpen(false)}/>
    </div>);
}

function PersonMenu({ person, removable, onRemove }: { person: Person; removable: boolean; onRemove: () => void }) {
    const router = useRouter();
    const phone = person.contact_number;
    const crew = person.role === "middleman";
    if (!phone && !removable && !crew)
        return <span aria-hidden/>;
    async function classify(value: CrewClassification) {
        try {
            await setClassification(person.id, value);
            toast.success(`${person.full_name || "This person"} is now ${CLASSIFICATION_TERMS[value]}`);
            router.refresh();
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Unable to change the classification.");
        }
    }
    return (<DropdownMenu>
      <DropdownMenuTrigger type="button" aria-label={`Actions for ${person.full_name || "this person"}`} className={cn("grid size-9 place-items-center rounded-full text-ink-tertiary transition-colors hover:bg-surface-sunken hover:text-ink data-popup-open:bg-surface-sunken data-popup-open:text-ink", focusRing)}>
        <MoreHorizontal className="size-[18px]" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-[12px] p-1.5">
        {crew ? (<>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Called on site</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={person.classification ?? ""} onValueChange={(v) => { if (v && v !== person.classification) void classify(v as CrewClassification); }}>
                {(Object.keys(CLASSIFICATION_TERMS) as CrewClassification[]).map((c) => (<DropdownMenuRadioItem key={c} value={c} className="h-9 rounded-[8px]">{CLASSIFICATION_TERMS[c]}</DropdownMenuRadioItem>))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            {phone || removable ? <DropdownMenuSeparator /> : null}
          </>) : null}
        {phone ? (<>
            <DropdownMenuItem onClick={() => { window.location.href = `tel:${phone.replace(/\s/g, "")}`; }} className="h-9 rounded-[8px]">
              <Phone aria-hidden/>Call {phone}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void navigator.clipboard.writeText(phone).then(() => toast.success("Phone number copied"))} className="h-9 rounded-[8px]">
              <Copy aria-hidden/>Copy phone number
            </DropdownMenuItem>
          </>) : null}
        {phone && removable ? <DropdownMenuSeparator /> : null}
        {removable ? (<DropdownMenuItem variant="destructive" onClick={onRemove} className="h-9 rounded-[8px]">
            <UserMinus aria-hidden/>Remove account…
          </DropdownMenuItem>) : null}
      </DropdownMenuContent>
    </DropdownMenu>);
}

/** Says up front what removing someone will touch: a client on a project can't go, a PM's projects need a successor. */
function RemoveDialog({ person, open, people, onClose }: { person: Person | null; open: boolean; people: Person[]; onClose: () => void }) {
    const router = useRouter();
    const [reassignTo, setReassignTo] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);
    const successors = people.filter((p) => p.role === "project_manager" && p.id !== person?.id);
    const blocked = (person?.clientOf ?? 0) > 0;
    const needsSuccessor = (person?.managed ?? 0) > 0;
    const name = person?.full_name || "this person";

    function close() {
        if (busy)
            return;
        setReassignTo("");
        setError(null);
        onClose();
    }

    async function confirm() {
        if (!person)
            return;
        setError(null);
        setBusy(true);
        try {
            await deleteUser(person.id, needsSuccessor ? reassignTo : undefined);
            toast.success(`${name} was removed`);
            setBusy(false);
            setReassignTo("");
            onClose();
            router.refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Unable to remove the account.");
            setBusy(false);
        }
    }

    return (<Dialog open={open && person !== null} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="gap-0 rounded-[20px] p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-6 pb-5">
          <span className="mb-2 grid size-11 place-items-center rounded-full bg-danger-soft text-danger" aria-hidden><UserMinus className="size-5"/></span>
          <DialogTitle className="text-[19px] tracking-[-0.018em]">Remove {name}?</DialogTitle>
          <DialogDescription>
            {person ? `${personTitle(person)}. ` : null}Their sign-in stops working right away, and this can’t be undone.
          </DialogDescription>
        </DialogHeader>

        {blocked || needsSuccessor || error ? (<div className="space-y-4 px-6 pb-6">
            {blocked ? (<p className="rounded-[12px] bg-warning-soft px-3.5 py-3 text-[13px] leading-relaxed text-warning">
                {name.split(" ")[0]} is the client on {plural(person!.clientOf, "project")}. Remove {person!.clientOf === 1 ? "that project" : "those projects"} first, then come back.
              </p>) : needsSuccessor ? (successors.length > 0 ? (<div className="space-y-1.5">
                  <Label htmlFor="reassign-pm">Hand their {plural(person!.managed, "project")} to</Label>
                  <select id="reassign-pm" value={reassignTo} disabled={busy} onChange={(e) => setReassignTo(e.target.value)} className="h-10 w-full rounded-[10px] border border-input bg-surface px-3 text-sm text-ink outline-none hover:border-ink-tertiary/60 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/20">
                    <option value="" disabled>Choose a project manager…</option>
                    {successors.map((pm) => (<option key={pm.id} value={pm.id}>
                        {pm.full_name || "Unnamed project manager"}{pm.activeProjects > 0 ? ` · ${plural(pm.activeProjects, "active project")}` : ""}
                      </option>))}
                  </select>
                </div>) : (<p className="rounded-[12px] bg-warning-soft px-3.5 py-3 text-[13px] leading-relaxed text-warning">
                  {name.split(" ")[0]} manages {plural(person!.managed, "project")} and there’s no other project manager to take over. Add one first.
                </p>)) : null}
            {error ? <p className="rounded-[12px] bg-danger-soft px-3.5 py-3 text-[13px] text-danger" role="alert">{error}</p> : null}
          </div>) : null}

        <DialogFooter className="mx-0 mb-0 rounded-b-[20px] px-6 py-4">
          <Button type="button" variant="ghost" disabled={busy} onClick={close} className="rounded-full">Cancel</Button>
          <Button type="button" variant="destructive" disabled={busy || blocked || (needsSuccessor && !reassignTo)} onClick={() => void confirm()} className="rounded-full px-5">
            {busy ? <><Loader2 className="animate-spin" aria-hidden/>Removing…</> : needsSuccessor ? "Hand over and remove" : "Remove account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
