"use client";
import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { removeRealtimeChannelByName } from "@/lib/supabase/realtime-channel";
import { formatActivitySentence } from "@/lib/activity-presentation";
import { cn } from "@/lib/utils";
import { listProjectActivity, type ActivityWithActor } from "@/services/activity-service";
export function ProjectActivityFeed({ projectId, initialItems, }: {
    projectId: string;
    initialItems: ActivityWithActor[];
}) {
    const [items, setItems] = React.useState<ActivityWithActor[]>(initialItems);
    React.useEffect(() => {
        setItems(initialItems);
    }, [initialItems]);
    React.useEffect(() => {
        const sb = createClient();
        const channelName = `activity:${projectId}`;
        removeRealtimeChannelByName(sb, channelName);
        const channel = sb.channel(channelName);
        channel
            .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "activity_feed",
            filter: `project_id=eq.${projectId}`,
        }, () => {
            void listProjectActivity(projectId, 80).then(setItems).catch(() => { });
        })
            .subscribe();
        return () => {
            void sb.removeChannel(channel);
        };
    }, [projectId]);
    if (items.length === 0) {
        return (<div className="border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center text-sm text-slate-500">
        Activity from board moves, milestones, and message uploads will stream here in real time.
      </div>);
    }
    return (<ul className="divide-y divide-slate-100 border border-slate-200 bg-white">
      {items.map((row) => (<li key={row.id} className="flex gap-3 px-4 py-3">
          <div className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#d97706]", row.action_type === "task_moved" && "bg-slate-400", row.action_type === "milestone_rescheduled" && "bg-amber-500", row.action_type === "milestone_completed" && "bg-emerald-600")}/>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-slate-800">
              {formatActivitySentence(row)}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
              {new Date(row.created_at).toLocaleString()}
            </p>
          </div>
        </li>))}
    </ul>);
}
