"use client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProject, type ProjectWithRelations } from "@/services/project-service";
export function UpdateProjectForm({ project }: {
    project: ProjectWithRelations;
}) {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setSaving(true);
        const fd = new FormData(e.currentTarget);
        try {
            await updateProject({
                id: project.id,
                title: String(fd.get("title") ?? "").trim(),
                description: String(fd.get("description") ?? "").trim() || null,
                start_date: String(fd.get("start_date") ?? project.start_date),
                end_date: String(fd.get("end_date") ?? project.end_date),
            });
            router.refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save.");
        }
        finally {
            setSaving(false);
        }
    }
    return (<form className="space-y-6 border border-slate-200 bg-white p-6" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="title">Project title</Label>
        <Input id="title" name="title" defaultValue={project.title} required className="h-11 rounded-none"/>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea id="description" name="description" defaultValue={project.description ?? ""} rows={4} className="w-full border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"/>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start date</Label>
          <Input id="start_date" name="start_date" type="date" defaultValue={project.start_date} required className="h-11 rounded-none"/>
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End date</Label>
          <Input id="end_date" name="end_date" type="date" defaultValue={project.end_date} required className="h-11 rounded-none"/>
        </div>
      </div>
      {error ? (<div className="flex gap-2 border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>
          {error}
        </div>) : null}
      <Button type="submit" disabled={saving} className="h-10 rounded-none bg-[#d97706] px-6 font-mono text-xs uppercase tracking-[0.18em] text-slate-950 hover:bg-[#ef9b27]">
        {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : "Save workspace settings"}
      </Button>
    </form>);
}
