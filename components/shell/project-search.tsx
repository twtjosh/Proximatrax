"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, FolderKanban, Search } from "lucide-react";
import { ProjectStatusBadge } from "@/components/system/status-badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { projectPath } from "@/lib/constants";
import type { NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { listProjects, type ProjectWithRelations } from "@/services/project-service";

type Result = {
    key: string;
    label: string;
    detail?: string;
    href: string;
    project?: ProjectWithRelations;
    icon: NavItem["icon"];
};

type ProjectSearchProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    navItems: NavItem[];
};

function matches(haystack: string, query: string) {
    return haystack.toLowerCase().includes(query);
}

export function ProjectSearch({ open, onOpenChange, navItems }: ProjectSearchProps) {
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="top-[12vh] max-w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Search projects</DialogTitle>
        <DialogDescription className="sr-only">Type a project or client name, then press Enter to open it.</DialogDescription>
        {open ? <SearchBody navItems={navItems} onClose={() => onOpenChange(false)}/> : null}
      </DialogContent>
    </Dialog>);
}

/** Mounted only while the dialog is open, so every search starts fresh. */
function SearchBody({ navItems, onClose }: {
    navItems: NavItem[];
    onClose: () => void;
}) {
    const router = useRouter();
    const [query, setQuery] = React.useState("");
    const [projects, setProjects] = React.useState<ProjectWithRelations[] | null>(null);
    const [failed, setFailed] = React.useState(false);
    const [cursor, setCursor] = React.useState(0);
    const listRef = React.useRef<HTMLUListElement>(null);

    React.useEffect(() => {
        let cancelled = false;
        listProjects()
            .then((rows) => {
            if (!cancelled)
                setProjects(rows);
        })
            .catch(() => {
            if (!cancelled)
                setFailed(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const results = React.useMemo<Result[]>(() => {
        const q = query.trim().toLowerCase();
        const pages: Result[] = navItems
            .filter((item) => !q || matches(item.label, q))
            .map((item) => ({ key: `nav:${item.href}`, label: item.label, href: item.href, icon: item.icon }));
        const projectRows: Result[] = (projects ?? [])
            .filter((p) => !q || matches(p.title, q) || matches(p.client?.full_name ?? "", q))
            .sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed"))
            .slice(0, 12)
            .map((p) => ({
            key: `project:${p.id}`,
            label: p.title,
            detail: p.client?.full_name ?? undefined,
            href: projectPath(p.id),
            project: p,
            icon: FolderKanban,
        }));
        return q ? [...projectRows, ...pages] : [...pages, ...projectRows];
    }, [navItems, projects, query]);

    React.useEffect(() => {
        listRef.current
            ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }, [cursor]);

    function go(result: Result | undefined) {
        if (!result)
            return;
        onClose();
        router.push(result.href);
    }

    function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setCursor((c) => Math.min(c + 1, Math.max(results.length - 1, 0)));
        }
        else if (event.key === "ArrowUp") {
            event.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
        }
        else if (event.key === "Enter") {
            event.preventDefault();
            go(results[cursor]);
        }
    }

    const loading = projects === null && !failed;

    return (<>
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-ink-tertiary" aria-hidden/>
          <input autoFocus value={query} onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
        }} onKeyDown={onKeyDown} placeholder="Search projects or clients" aria-label="Search projects or clients" role="combobox" aria-expanded="true" aria-controls="project-search-results" aria-activedescendant={results[cursor] ? `project-search-${cursor}` : undefined} className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-tertiary"/>
        </div>
        <ul ref={listRef} id="project-search-results" role="listbox" aria-label="Results" className="max-h-[min(60vh,24rem)] overflow-y-auto p-1.5">
          {results.map((result, index) => {
            const Icon = result.icon;
            const active = index === cursor;
            return (<li key={result.key} id={`project-search-${index}`} role="option" aria-selected={active} data-index={index}>
                <button type="button" onMouseMove={() => setCursor(index)} onClick={() => go(result)} className={cn("flex w-full cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-left", active ? "bg-surface-sunken" : "")}>
                  <Icon className="size-4 shrink-0 text-ink-tertiary" aria-hidden/>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{result.label}</span>
                    {result.detail ? (<span className="block truncate text-xs text-ink-tertiary">{result.detail}</span>) : null}
                  </span>
                  {result.project ? <ProjectStatusBadge status={result.project.status}/> : null}
                  {active ? <CornerDownLeft className="size-3.5 shrink-0 text-ink-tertiary" aria-hidden/> : null}
                </button>
              </li>);
        })}
          {loading ? (<li className="px-2.5 py-3 text-sm text-ink-tertiary">Loading projects…</li>) : null}
          {failed ? (<li className="px-2.5 py-3 text-sm text-danger">Projects could not be loaded. Close and try again.</li>) : null}
          {!loading && !failed && results.length === 0 ? (<li className="px-2.5 py-8 text-center text-sm text-ink-secondary">
              No projects match “{query.trim()}”.
            </li>) : null}
        </ul>
      </>);
}
