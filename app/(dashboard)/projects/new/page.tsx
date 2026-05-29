"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { projectPath, ROUTES } from "@/lib/constants";
import { getErrorMessage } from "@/lib/utils";
import { getCurrentAuthSession } from "@/services/auth-service";
import { DEFAULT_LIFECYCLE_TEMPLATE, listProfilesByRoles, } from "@/services/project-service";
import type { Profile } from "@/types/database";
function formatBriefDate(iso: string): string {
    if (!iso)
        return "—";
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return iso;
    return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}
export default function NewProjectPage() {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [viewerPmId, setViewerPmId] = useState<string | null>(null);
    const [viewerName, setViewerName] = useState<string>("");
    const [middlemanId, setMiddlemanId] = useState("");
    const [clientId, setClientId] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [useTemplate, setUseTemplate] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [middlemen, setMiddlemen] = useState<Profile[]>([]);
    const [clients, setClients] = useState<Profile[]>([]);
    useEffect(() => {
        getCurrentAuthSession().then((session) => {
            if (!session) {
                router.replace(ROUTES.LOGIN);
                return;
            }
            if (session.profile?.role === "super_admin") {
                router.replace(ROUTES.DASHBOARD);
                return;
            }
            if (session.profile?.role !== "project_manager") {
                router.replace(ROUTES.PROJECTS);
                return;
            }
            setViewerPmId(session.user.id);
            setViewerName(session.profile.full_name || "You");
        });
        listProfilesByRoles(["middleman"]).then(setMiddlemen);
        listProfilesByRoles(["client"]).then(setClients);
    }, [router]);
    const selectedClient = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);
    const selectedMiddleman = useMemo(() => middlemen.find((m) => m.id === middlemanId), [middlemen, middlemanId]);
    const previewTitle = title.trim() || "Untitled engagement";
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        if (!viewerPmId) {
            setError("Session not ready. Refresh the page and try again.");
            return;
        }
        setIsSubmitting(true);
        try {
            const response = await fetch("/api/projects/with-invitations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description: description || null,
                    clientId,
                    middlemanId,
                    startDate,
                    endDate,
                    useTemplate,
                }),
            });
            const payload = (await response.json()) as {
                error?: string;
                projectId?: string;
            };
            if (!response.ok) {
                throw new Error(payload.error ?? "Unable to create project.");
            }
            if (!payload.projectId) {
                throw new Error("Project was created but no project id was returned.");
            }
            router.push(projectPath(payload.projectId));
            router.refresh();
        }
        catch (err) {
            setError(getErrorMessage(err));
        }
        finally {
            setIsSubmitting(false);
        }
    }
    const selectClassName = "h-11 w-full border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring rounded-none";
    return (<div className="mx-auto max-w-6xl pb-16">
      <Link href={ROUTES.PROJECTS} className="mb-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500 hover:text-slate-950">
        <ArrowLeft className="h-3.5 w-3.5"/>
        Back to projects
      </Link>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-14">
        
        <aside className="space-y-6 lg:sticky lg:top-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#d97706]">
              Workspace · New engagement
            </p>
            <h1 className="mt-2 font-heading text-3xl tracking-tight text-slate-950 md:text-4xl">
              Open a new operational workspace
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
              You lead delivery as project manager. Name the engagement, invite
              the client and field coordinator, then lock the timeline — they
              must accept before the roster goes live.
            </p>
          </div>

          <div className="border border-slate-200 bg-linear-to-b from-slate-50 to-white p-6 shadow-sm md:p-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
              Live brief
            </p>
            <p className="mt-4 font-heading text-2xl leading-snug tracking-tight text-slate-950">
              {previewTitle}
            </p>
            {description.trim() ? (<p className="mt-3 line-clamp-4 text-sm text-slate-600">
                {description.trim()}
              </p>) : (<p className="mt-3 text-sm italic text-slate-400">
                Scope notes appear here as you write them.
              </p>)}

            <dl className="mt-8 space-y-5 border-t border-slate-200 pt-6 text-sm">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Project manager
                </dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {viewerName || "—"}
                </dd>
                <dd className="mt-0.5 text-xs text-slate-500">
                  Always you — this workspace is created under your ownership.
                </dd>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    Client
                  </dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {selectedClient?.full_name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    Middleman
                  </dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {selectedMiddleman?.full_name ?? "—"}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  <CalendarRange className="h-3.5 w-3.5 text-[#d97706]"/>
                  Timeline
                </dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {startDate && endDate
            ? `${formatBriefDate(startDate)} → ${formatBriefDate(endDate)}`
            : "Select start and end dates"}
                </dd>
              </div>
            </dl>
          </div>
        </aside>

        
        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-[#1e293b] px-6 py-5 md:px-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
              Configuration
            </p>
            <h2 className="mt-1 font-heading text-xl tracking-tight text-white">
              Engagement details
            </h2>
          </div>

          <form className="space-y-8 p-6 md:p-8" onSubmit={handleSubmit}>
            <section className="space-y-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Identity
              </p>
              <div className="space-y-2">
                <Label htmlFor="title">Project title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AEG Showroom Fit-Out" required className="h-11 rounded-none border-slate-300 focus-visible:ring-[#d97706]"/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Scope, constraints, or handover expectations…" rows={3} className="w-full border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#d97706]/40 rounded-none"/>
              </div>
            </section>

            <section className="space-y-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                People
              </p>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="client">Client</Label>
                  <select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)} required className={selectClassName}>
                    <option value="">Select client…</option>
                    {clients.map((c) => (<option key={c.id} value={c.id}>
                        {c.full_name}
                      </option>))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middleman">Middleman</Label>
                  <select id="middleman" value={middlemanId} onChange={(e) => setMiddlemanId(e.target.value)} required className={selectClassName}>
                    <option value="">Select middleman…</option>
                    {middlemen.map((m) => (<option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>))}
                  </select>
                  <p className="text-xs text-slate-500">
                    Field coordinator for this engagement; receives an invitation
                    to accept before joining the workspace.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Schedule
              </p>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start date</Label>
                  <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="h-11 rounded-none border-slate-300 focus-visible:ring-[#d97706]"/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End date</Label>
                  <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="h-11 rounded-none border-slate-300 focus-visible:ring-[#d97706]"/>
                </div>
              </div>
            </section>

            <section>
              <label htmlFor="use-template" className="flex cursor-pointer items-start gap-3 border border-slate-200 bg-slate-50/80 p-4 transition-colors hover:border-[#d97706]/40">
                <input id="use-template" type="checkbox" checked={useTemplate} onChange={(e) => setUseTemplate(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#d97706]"/>
                <span className="space-y-1">
                  <span className="block font-mono text-[11px] uppercase tracking-[0.2em] text-slate-700">
                    Use default lifecycle template
                  </span>
                  <span className="block text-sm text-slate-600">
                    Auto-seed five milestones across the timeline:{" "}
                    <span className="font-medium text-slate-800">
                      {DEFAULT_LIFECYCLE_TEMPLATE.join(" → ")}
                    </span>
                    . Editable later from Overview.
                  </span>
                </span>
              </label>
            </section>

            {error ? (<div className="flex gap-2 border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>
                <span>{error}</span>
              </div>) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
              <Button type="submit" disabled={isSubmitting || !viewerPmId} className="h-10 rounded-none border border-[#d97706]/30 bg-[#d97706] px-6 font-mono text-xs uppercase tracking-[0.2em] text-slate-950 hover:bg-[#ef9b27]">
                {isSubmitting ? "Sending invites…" : "Send invitations"}
                <ArrowRight className="h-4 w-4"/>
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push(ROUTES.PROJECTS)} className="h-10 rounded-none font-mono text-xs uppercase tracking-[0.2em]">
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>);
}
