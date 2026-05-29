"use client";
import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { removeRealtimeChannelByName } from "@/lib/supabase/realtime-channel";
import { formatActivitySentence } from "@/lib/activity-presentation";
import { projectPath } from "@/lib/constants";
import { listRecentActivityForViewer, type ActivityWithActor } from "@/services/activity-service";
export function GlobalActivityFeed({ initialItems, projectTitles, rowAsProjectLink, maxRows, maxVisibleRows, }: {
    initialItems: ActivityWithActor[];
    projectTitles: Record<string, string>;
    rowAsProjectLink?: boolean;
    maxRows?: number;
    maxVisibleRows?: number;
}) {
    const [items, setItems] = React.useState<ActivityWithActor[]>(initialItems);
    React.useEffect(() => {
        setItems(initialItems);
    }, [initialItems]);
    React.useEffect(() => {
        const sb = createClient();
        const channel = sb
            .channel("workspace-activity")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_feed" }, () => {
            void listRecentActivityForViewer(40)
                .then(setItems)
                .catch(() => { });
        })
            .subscribe();
        return () => {
            void sb.removeChannel(channel);
        };
    }, []);
    const visible = maxRows != null ? items.slice(0, maxRows) : items;
    if (items.length === 0) {
        return (<p className="border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500">
        Operational activity will appear here as your team moves work across projects.
      </p>);
    }
    return (<div className={maxVisibleRows != null ? "overflow-y-auto" : undefined} style={maxVisibleRows != null
            ? { maxHeight: `calc(${maxVisibleRows} * 5.25rem)` }
            : undefined}>
      <ul className="divide-y divide-slate-100 border border-slate-200 bg-white">
        {visible.map((row) => {
            const title = projectTitles[row.project_id] ?? "Project";
            const body = (<>
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#d97706]"/>
            <div className="min-w-0 flex-1">
              <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${rowAsProjectLink ? "text-[#9a4f02]" : "text-slate-400"}`}>
                {rowAsProjectLink ? (<span>{title}</span>) : (<Link href={projectPath(row.project_id)} className="text-[#9a4f02] hover:text-[#d97706]">
                    {title}
                  </Link>)}
              </p>
              <p className="text-sm leading-relaxed text-slate-800">
                {formatActivitySentence(row)}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                {new Date(row.created_at).toLocaleString()}
              </p>
            </div>
          </>);
            return (<li key={row.id}>
            {rowAsProjectLink ? (<Link href={projectPath(row.project_id)} className="flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50/90">
                {body}
              </Link>) : (<div className="flex gap-3 px-4 py-3">{body}</div>)}
          </li>);
        })}
      </ul>
    </div>);
}
