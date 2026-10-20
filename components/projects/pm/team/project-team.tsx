"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Loader2, MessageSquare, MoreHorizontal, Phone, Search, UserMinus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Face, focusRing, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { openChat } from "@/components/messenger/messenger-store";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { projectBoardPath } from "@/lib/constants";
import { agoPhrase, isoDateIn, plural } from "@/lib/dashboard";
import type { TeamMember } from "@/lib/data/project-context";
import { SPRING } from "@/lib/motion";
import { peopleLoad } from "@/lib/people-load";
import { cn } from "@/lib/utils";
import { CLASSIFICATION_TERMS, ROLE_TERMS, personTitle } from "@/lib/vocabulary";
import { logActivity } from "@/services/activity-service";
import { createProjectInvitations, deleteProjectInvitation } from "@/services/project-invitation-service";
import { removeProjectMember } from "@/services/project-service";
import type { Profile, ProjectInvitationWithInvitee } from "@/types/database";
import type { CrewClassification } from "@/types/enums";

type TeamTask = { id: string; title: string; assigned_to: string | null; stage: string; due_date: string | null };

/**
 * Who is on the project and how to reach them, what each person is carrying,
 * and the means to change the team: invite more crew, take someone off
 * (their open work goes back to no one), follow up on invitations.
 */
export function ProjectTeam({ projectId, projectTitle, viewerId, team, contacts, tasks, invitations, crewPool, today, closed, canMessage = true }: {
    projectId: string;
    projectTitle: string;
    viewerId: string;
    team: TeamMember[];
    /** Phone numbers by person, where they gave one. */
    contacts: Record<string, string>;
    tasks: TeamTask[];
    invitations: ProjectInvitationWithInvitee[];
    /** Every middleman in the company, to invite from. */
    crewPool: Pick<Profile, "id" | "full_name" | "avatar_url" | "classification">[];
    today: string;
    closed: boolean;
    /** False for the super admin, who is not in the project's chat. */
    canMessage?: boolean;
}) {
    const router = useRouter();
    const reduce = useReducedMotion();
    const [inviting, setInviting] = React.useState(false);
    const load = peopleLoad(team, tasks, today);
    const crew = load.filter((p) => p.role === ROLE_TERMS.middleman);
    const leads = load.filter((p) => p.role !== ROLE_TERMS.middleman);
    const most = Math.max(1, ...crew.map((p) => p.open));
    const open = invitations.filter((i) => i.status !== "accepted" && !team.some((m) => m.id === i.invitee_id));
    const onTeam = new Set([...team.map((m) => m.id), ...open.filter((i) => i.status === "pending").map((i) => i.invitee_id)]);
    const available = crewPool.filter((p) => !onTeam.has(p.id));

    async function invite(p: Pick<Profile, "id" | "full_name">) {
        try {
            // A declined invitation blocks a new one for the same person; clear it first.
            const old = invitations.find((i) => i.invitee_id === p.id && i.invitee_role === "middleman");
            if (old)
                await deleteProjectInvitation(old.id);
            await createProjectInvitations([{ project_id: projectId, invitee_id: p.id, invitee_role: "middleman", invited_by: viewerId, project_title: projectTitle }]);
            toast.success(`Invited ${p.full_name}`, { description: "They join once they accept from their dashboard." });
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "That invitation didn't send.");
        }
    }
    async function cancel(i: ProjectInvitationWithInvitee) {
        try {
            await deleteProjectInvitation(i.id);
            toast.success(i.status === "declined" ? "Cleared" : `Cancelled the invitation to ${i.invitee?.full_name ?? "them"}`);
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "That didn't go through. Migration 0024 may not have run yet.");
        }
    }
    async function remove(p: TeamMember, openCount: number) {
        try {
            await removeProjectMember(projectId, p.id);
            void logActivity({ project_id: projectId, action_type: "member_removed", details: { user_id: p.id, name: p.name } });
            toast.success(`${p.name} is off the project`, { description: openCount ? `${plural(openCount, "open task")} went back to No one.` : undefined });
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "That didn't go through.");
        }
    }

    return (<div className="grid gap-6 pt-2">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink-secondary"><b className="font-semibold text-ink">{crew.length} {crew.length === 1 ? "person" : "people"}</b> on site · {plural(tasks.filter((t) => t.stage !== "done").length, "open task")} between them</p>
        {!closed ? <button type="button" onClick={() => setInviting(true)} className={cn(primaryAction, "ml-auto h-9 px-4")}><UserPlus aria-hidden/>Invite crew</button> : null}
      </div>

      <section aria-label="Crew" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {crew.length === 0 ? <p className="rounded-[22px] border border-dashed border-line-strong px-6 py-10 text-center text-sm text-ink-secondary sm:col-span-2 xl:col-span-3">No crew on this project yet. Invite someone to start giving out work.</p> : null}
        <AnimatePresence initial={false}>
          {crew.map((p, i) => {
            const working = tasks.filter((t) => t.assigned_to === p.id && t.stage === "in_progress");
            const accepted = tasks.filter((t) => t.assigned_to === p.id && t.stage === "done").length;
            return (<motion.article key={p.id} layout={!reduce} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ ...SPRING, delay: reduce ? 0 : 0.04 * i }} className="grid gap-4 rounded-[22px] material p-5">
                <header className="flex items-start gap-3">
                  <Face person={p} size={44}/>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold text-ink">{p.name}</h3>
                    <p className="text-xs text-ink-tertiary">{p.title ?? p.role}</p>
                  </div>
                  {!closed ? <MemberMenu name={p.name} openCount={p.open} onRemove={() => void remove(p, p.open)}/> : null}
                </header>
                <div className="grid grid-cols-4 gap-1 text-center">
                  <Stat n={p.open} label="Open"/>
                  <Stat n={p.late} label="Late" tone={p.late ? "text-danger" : undefined}/>
                  <Stat n={p.review} label="In review" tone={p.review ? "text-warning" : undefined}/>
                  <Stat n={accepted} label="Accepted" tone={accepted ? "text-success" : undefined}/>
                </div>
                <div>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                    <motion.span className={cn("block h-full rounded-full", p.late ? "bg-stage-late" : "bg-brand")} initial={reduce ? false : { width: 0 }} animate={{ width: `${(p.open / most) * 100}%` }} transition={{ ...SPRING, delay: 0.1 + 0.04 * i }}/>
                  </span>
                  <p className="mt-2 truncate text-xs text-ink-secondary">{working.length ? <>Working on <b className="font-medium text-ink">{working[0].title}</b>{working.length > 1 ? ` +${working.length - 1}` : ""}</> : p.open ? "Nothing under way right now" : "Free for new work"}</p>
                </div>
                <footer className="flex flex-wrap gap-1.5">
                  {contacts[p.id] ? <a href={`tel:${contacts[p.id].replace(/\s+/g, "")}`} className={cn(softAction, "h-9 px-3.5")}><Phone aria-hidden/>{contacts[p.id]}</a> : null}
                  {canMessage ? <button type="button" onClick={() => openChat(projectId)} className={cn(softAction, "h-9 px-3.5")}><MessageSquare aria-hidden/>Message</button> : null}
                  <Link href={projectBoardPath(projectId, { assignee: p.id })} className={cn(softAction, "ml-auto h-9 px-3.5")}>Their tasks<ArrowUpRight aria-hidden/></Link>
                </footer>
              </motion.article>);
        })}
        </AnimatePresence>
      </section>

      {open.length > 0 ? (<section aria-label="Invitations" className="grid gap-2">
          <h2 className="text-sm font-semibold text-ink">Invitations</h2>
          <ul className="materialize overflow-hidden rounded-[22px] material">
            {open.map((i) => (<li key={i.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <Face person={{ id: i.invitee_id, name: i.invitee?.full_name ?? "Someone", avatarUrl: i.invitee?.avatar_url ?? null, role: "" }} size={30}/>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{i.invitee?.full_name ?? "Someone"}</span>
                  <span className="block text-xs text-ink-tertiary">{i.invitee ? personTitle(i.invitee) : ROLE_TERMS[i.invitee_role]} · invited {agoPhrase(isoDateIn(i.created_at), today)}</span>
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", i.status === "declined" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>{i.status === "declined" ? "Declined" : "Waiting"}</span>
                {!closed ? (i.status === "declined" && i.invitee_role === "middleman" && i.invitee ? <button type="button" onClick={() => void invite(i.invitee!)} className={cn(softAction, "h-8")}>Invite again</button> : <button type="button" onClick={() => void cancel(i)} aria-label={`Cancel the invitation to ${i.invitee?.full_name ?? "them"}`} className={cn("grid size-8 cursor-pointer place-items-center rounded-full text-ink-tertiary hover:bg-surface-sunken hover:text-ink", focusRing)}><X className="size-4" aria-hidden/></button>) : null}
              </li>))}
          </ul>
        </section>) : null}

      <section aria-label="Project manager and client" className="grid gap-2">
        <h2 className="text-sm font-semibold text-ink">Leads</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {leads.map((p) => (<li key={p.id} className="flex items-center gap-3 rounded-[22px] material p-4">
              <Face person={p} size={38}/>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{p.name}{p.id === viewerId ? <span className="font-normal text-ink-tertiary"> (you)</span> : null}</span>
                <span className="block text-xs text-ink-tertiary">{p.role}{p.role === ROLE_TERMS.client ? " · sees accepted work and shared files" : p.open ? ` · ${plural(p.open, "open task")}` : ""}</span>
              </span>
              {contacts[p.id] && p.id !== viewerId ? <a href={`tel:${contacts[p.id].replace(/\s+/g, "")}`} aria-label={`Call ${p.name}`} className={cn(softAction, "h-9 px-3")}><Phone aria-hidden/><span className="max-sm:hidden">{contacts[p.id]}</span></a> : null}
              {canMessage && p.id !== viewerId ? <button type="button" onClick={() => openChat(projectId)} aria-label={`Message ${p.name}`} className={cn(softAction, "h-9 px-3")}><MessageSquare aria-hidden/></button> : null}
            </li>))}
        </ul>
      </section>

      <InviteDialog open={inviting} onOpenChange={setInviting} people={available} onInvite={invite}/>
    </div>);
}

function Stat({ n, label, tone }: {
    n: number;
    label: string;
    tone?: string;
}) {
    return (<div className="rounded-xl bg-surface-subtle py-2">
      <p className={cn("text-lg leading-none font-semibold tabular", tone ?? "text-ink")}>{n}</p>
      <p className="mt-1 text-[10px] font-medium text-ink-tertiary">{label}</p>
    </div>);
}

function MemberMenu({ name, openCount, onRemove }: {
    name: string;
    openCount: number;
    onRemove: () => void;
}) {
    const [confirm, setConfirm] = React.useState(false);
    return (<DropdownMenu onOpenChange={(o) => !o && setConfirm(false)}>
      <DropdownMenuTrigger aria-label={`Options for ${name}`} className={cn("grid size-8 cursor-pointer place-items-center rounded-full text-ink-tertiary hover:bg-surface-sunken hover:text-ink", focusRing)}>
        <MoreHorizontal className="size-4" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        {confirm ? (<>
            <p className="px-2 py-1.5 text-xs text-ink-secondary">{openCount ? `Their ${plural(openCount, "open task")} go back to No one.` : "They have no open tasks."}</p>
            <DropdownMenuItem onClick={onRemove} className="text-danger focus:text-danger"><UserMinus aria-hidden/>Yes, take {name.split(" ")[0]} off</DropdownMenuItem>
          </>) : (<DropdownMenuItem closeOnClick={false} onClick={() => setConfirm(true)} className="text-danger focus:text-danger"><UserMinus aria-hidden/>Remove from project</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>);
}

function InviteDialog({ open, onOpenChange, people, onInvite }: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    people: Pick<Profile, "id" | "full_name" | "avatar_url" | "classification">[];
    onInvite: (p: Pick<Profile, "id" | "full_name">) => Promise<void>;
}) {
    const [q, setQ] = React.useState("");
    const [busy, setBusy] = React.useState<string | null>(null);
    const [sent, setSent] = React.useState<Set<string>>(() => new Set());
    const [kind, setKind] = React.useState<CrewClassification | "all">("all");
    const kinds = (Object.keys(CLASSIFICATION_TERMS) as CrewClassification[]).filter((c) => people.some((p) => p.classification === c));
    const list = people.filter((p) => (kind === "all" || p.classification === kind) && p.full_name.toLowerCase().includes(q.trim().toLowerCase()));
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>Invite crew</DialogTitle>
          <DialogDescription>Middlemen join once they accept. You can give them tasks right after.</DialogDescription>
        </DialogHeader>
        <label className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-ink-tertiary" aria-hidden/>
          <span className="sr-only">Search people</span>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm focus:border-brand focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none"/>
        </label>
        {kinds.length > 1 ? (<div role="radiogroup" aria-label="Classification" className="-mt-1 flex flex-wrap gap-1.5">
            {(["all", ...kinds] as const).map((c) => (<button key={c} type="button" role="radio" aria-checked={kind === c} onClick={() => setKind(c)} className={cn("press inline-flex h-7 items-center rounded-full px-2.5 text-[12.5px] font-medium transition-colors", focusRing, kind === c ? "bg-ink text-white" : "bg-surface-sunken text-ink-secondary hover:text-ink")}>
                {c === "all" ? "Everyone" : CLASSIFICATION_TERMS[c]}
              </button>))}
          </div>) : null}
        <ul className="-mx-2 max-h-80 overflow-y-auto">
          {list.length === 0 ? <li className="px-2 py-6 text-center text-sm text-ink-tertiary">{people.length ? "No one by that name." : "Every middleman is already on this project or invited."}</li> : null}
          {list.map((p) => (<li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-sunken">
              <Face person={{ id: p.id, name: p.full_name, avatarUrl: p.avatar_url, role: "" }} size={32}/>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.full_name}</span>
                <span className="block truncate text-xs text-ink-tertiary">{personTitle({ role: "middleman", classification: p.classification })}</span>
              </span>
              <button type="button" disabled={busy === p.id || sent.has(p.id)} onClick={async () => {
                    setBusy(p.id);
                    await onInvite(p);
                    setBusy(null);
                    setSent((s) => new Set(s).add(p.id));
                }} className={cn(sent.has(p.id) ? softAction : primaryAction, "h-8 px-3.5 text-xs")}>
                {busy === p.id ? <Loader2 className="animate-spin" aria-hidden/> : null}{sent.has(p.id) ? "Invited" : "Invite"}
              </button>
            </li>))}
        </ul>
      </DialogContent>
    </Dialog>);
}
