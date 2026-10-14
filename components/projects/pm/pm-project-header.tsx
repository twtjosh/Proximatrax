"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Lock, MessageSquare, MoreHorizontal, Settings2, ShieldCheck } from "lucide-react";
import { useLiveUnread } from "@/components/messenger/messenger-store";
import { OpenChatButton } from "@/components/messenger/open-chat-button";
import { FaceStack, focusRing, HEALTH_TONE, ProgressRing, softAction } from "@/components/dashboard/overview-kit";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { TeamMember } from "@/lib/data/project-context";
import type { HealthTone } from "@/lib/dashboard";
import { ROUTES } from "@/lib/constants";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The project's identity on every tab: the same ring and health words as its
 * Overview tile, then what the PM reaches for from anywhere: the review
 * queue (when work waits), the people, Message, and settings. Condenses while
 * the page is scrolled, by scale and fade only: its height never changes, so
 * scrolling can't make it jump.
 */
export function PmProjectHeader({ projectId, title, client, accepted, total, tasksFailed, health, calendar, team, unread, compact, reviewCount, reviewHref, closed, onPeople, onSettings }: {
    projectId: string;
    title: string;
    client: string;
    accepted: number;
    total: number;
    /** Tasks failed to load: say so instead of "No tasks yet". */
    tasksFailed: boolean;
    health: { text: string; tone: HealthTone };
    calendar: string;
    team: TeamMember[];
    unread: number;
    compact: boolean;
    /** Submissions waiting on the PM; the pill shows only when there are some. */
    reviewCount: number;
    reviewHref: string;
    closed: boolean;
    onPeople: () => void;
    onSettings: (section?: "close") => void;
}) {
    const router = useRouter();
    const liveUnread = useLiveUnread(projectId, unread);
    const share = total > 0 ? accepted / total : 0;
    const tone = HEALTH_TONE[health.tone];

    // ponytail: same-origin referrer means we came from inside the app; deep links fall back to Projects.
    function back() {
        if (document.referrer.startsWith(window.location.origin) && window.history.length > 1)
            router.back();
        else
            router.push(ROUTES.PROJECTS);
    }

    return (<div className="flex items-center gap-3 sm:gap-4">
      <ProgressRing value={share} done={share >= 1 && health.tone !== "late"} size={54} stroke={5.5} className={cn("origin-left transition-[scale,translate] duration-500 ease-spring motion-reduce:transition-none", compact && "translate-y-2 scale-[0.67]")}>
        {/* The ring shrinks to two thirds when condensed; the number grows a little against it so it stays readable. */}
        <span className={cn("block text-[13px] font-semibold text-ink tabular transition-transform duration-500 ease-spring motion-reduce:transition-none", compact && "scale-[1.15]")}>{Math.round(share * 100)}</span>
      </ProgressRing>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={back} tabIndex={compact ? -1 : undefined} aria-hidden={compact || undefined} className={cn("mb-0.5 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-ink-tertiary transition-opacity duration-300 hover:text-ink motion-reduce:transition-none", compact && "pointer-events-none opacity-0", focusRing)}>
          <ArrowLeft className="size-3.5" aria-hidden/>
          Back
        </button>
        <h1 className={cn("origin-left truncate text-[1.75rem] leading-[1.05] font-semibold tracking-[-0.034em] text-ink transition-transform duration-500 ease-spring motion-reduce:transition-none", compact && "translate-y-2 scale-[0.68]")}>{title}</h1>
        <p className={cn("truncate text-[13px] text-ink-tertiary transition-opacity duration-300 motion-reduce:transition-none", compact && "opacity-0")}>
          {client}
          {" · "}
          {tasksFailed ? "Tasks unavailable" : total > 0 ? <><b className="font-medium text-ink">{accepted} of {total}</b> tasks accepted</> : "No tasks yet"}
          {" · "}
          <span className={cn("font-medium", tone.tone)}>{health.text}</span>
          {" · "}
          {calendar}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <AnimatePresence initial={false}>
          {reviewCount > 0 ? (<motion.span key="review" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }} transition={SPRING}>
              <Link href={reviewHref} className={cn("press inline-flex h-9 items-center gap-1.5 rounded-full bg-warning-soft px-3.5 text-[13px] font-semibold text-warning ring-1 ring-stage-review/40 hover:bg-stage-review/20", focusRing)}>
                <ShieldCheck className="size-4" aria-hidden/>
                <span className="tabular">{reviewCount}</span>
                <span className="max-sm:hidden">to review</span>
              </Link>
            </motion.span>) : null}
        </AnimatePresence>
        {team.length > 0 ? (<button type="button" onClick={onPeople} aria-label={`People on this project: ${team.map((m) => m.name).join(", ")}`} className={cn("press rounded-full p-0.5 max-sm:hidden hover:bg-surface-sunken", focusRing)}>
            <FaceStack people={team} max={3} size={28}/>
          </button>) : null}
        <OpenChatButton projectId={projectId} aria-label={liveUnread > 0 ? `Message, ${liveUnread} unread` : "Message"} className={cn(softAction, "relative h-9 px-3.5", liveUnread > 0 && "bg-brand-soft text-brand ring-1 ring-brand/20 hover:bg-brand-soft")}>
          <MessageSquare aria-hidden/>
          <span className="max-md:hidden">Message</span>
          {liveUnread > 0 ? <span aria-hidden className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white tabular max-md:absolute max-md:-top-1 max-md:-right-1 max-md:ring-2 max-md:ring-surface">{liveUnread > 9 ? "9+" : liveUnread}</span> : null}
        </OpenChatButton>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Project menu" className={cn("press grid size-9 cursor-pointer place-items-center rounded-full bg-surface-sunken text-ink hover:bg-line", focusRing)}>
            <MoreHorizontal className="size-4" aria-hidden/>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={onPeople} className="sm:hidden">People</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSettings()}><Settings2 aria-hidden/>Project settings<span className="ml-auto text-xs text-ink-tertiary">,</span></DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSettings("close")}><Lock aria-hidden/>{closed ? "Reopen project" : "Close project"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>);
}
