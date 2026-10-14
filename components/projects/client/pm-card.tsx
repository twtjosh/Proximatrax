"use client";
import { MessageSquare } from "lucide-react";
import { Face, primaryAction } from "@/components/dashboard/overview-kit";
import { OpenChatButton } from "@/components/messenger/open-chat-button";
import { cn } from "@/lib/utils";
import { ROLE_TERMS } from "@/lib/vocabulary";
import type { ProjectRelatedProfile } from "@/services/project-service";

/** The client's project manager, one tap from a message. */
export function PmCard({ projectId, pm }: {
    projectId: string;
    pm: ProjectRelatedProfile | null;
}) {
    if (!pm)
        return null;
    const person = { id: pm.id, name: pm.full_name, avatarUrl: pm.avatar_url, role: ROLE_TERMS.project_manager };
    return (<section aria-labelledby="your-pm" className="materialize rounded-[20px] material p-5">
      <h2 id="your-pm" className="text-xs font-medium text-ink-tertiary">Your project manager</h2>
      <div className="mt-3 flex items-center gap-3">
        <Face person={person} size={44}/>
        <span className="min-w-0 truncate text-[15px] font-semibold text-ink">{pm.full_name}</span>
      </div>
      <OpenChatButton projectId={projectId} className={cn(primaryAction, "mt-4 h-11 w-full justify-center")}>
        <MessageSquare aria-hidden/>
        Message {pm.full_name.split(" ")[0]}
      </OpenChatButton>
    </section>);
}
