"use client";
import { MessageCircleQuestion } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import { askAbout } from "@/components/messenger/messenger-store";
import { cn } from "@/lib/utils";

/** Opens the chat with "About <subject>: " already typed, so the PM knows exactly what the question is about. */
export function AskAbout({ projectId, subject, label = "Ask about this", className }: {
    projectId: string;
    subject: string;
    label?: string;
    className?: string;
}) {
    return (<button type="button" onClick={() => askAbout(projectId, subject)} className={cn("press inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium text-ink-secondary hover:bg-surface-sunken hover:text-ink", focusRing, className)}>
      <MessageCircleQuestion className="size-4" aria-hidden/>
      {label}
    </button>);
}
