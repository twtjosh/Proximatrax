"use client";
import Link from "next/link";
import { ChevronsUpDown, Download, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RAIL_TEXT } from "@/components/shell/rail";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/lib/constants";
import { IOS_STEPS, promptInstall, useInstallMode } from "@/lib/install-app";
import { accountPathFor } from "@/lib/navigation";
import { cn, getInitials } from "@/lib/utils";
import { ROLE_TERMS } from "@/lib/vocabulary";
import { logout } from "@/services/auth-service";
import type { Profile } from "@/types/database";

function ProfileAvatar({ profile, className }: {
    profile: Profile;
    className?: string;
}) {
    return (<Avatar className={cn("size-7 rounded-md after:rounded-md", className)}>
      {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" className="rounded-md"/> : null}
      <AvatarFallback className="rounded-md bg-brand text-[11px] font-semibold text-white">
        {getInitials(profile.full_name)}
      </AvatarFallback>
    </Avatar>);
}

export async function signOut() {
    try {
        await logout();
    }
    catch {
        // The session screen is left regardless; the proxy clears stale cookies.
    }
    window.location.replace(ROUTES.LOGIN);
}

type AccountMenuProps = {
    profile: Profile;
    appearance: "row" | "icon";
    side?: "right" | "bottom";
};

export function AccountMenu({ profile, appearance, side = "bottom" }: AccountMenuProps) {
    const accountHref = accountPathFor(profile.role);
    const install = useInstallMode();
    return (<DropdownMenu>
      <DropdownMenuTrigger type="button" aria-label={`Account menu for ${profile.full_name}`} className={cn("cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40", appearance === "row"
            ? "flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left hover:bg-rail-raised data-popup-open:bg-rail-raised"
            : "inline-flex size-9 items-center justify-center rounded-md hover:bg-rail-raised data-popup-open:bg-rail-raised")}>
        <ProfileAvatar profile={profile} className="shrink-0"/>
        {appearance === "row" ? (<>
            <span className={cn("min-w-0 flex-1 leading-tight", RAIL_TEXT)}>
              <span className="block truncate text-sm font-medium text-rail-ink">{profile.full_name}</span>
              <span className="block truncate text-xs text-rail-ink-tertiary">{ROLE_TERMS[profile.role]}</span>
            </span>
            <ChevronsUpDown className={cn("size-3.5 shrink-0 text-rail-ink-tertiary", RAIL_TEXT)} aria-hidden/>
          </>) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end" sideOffset={8} className="w-60">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <ProfileAvatar profile={profile} className="size-8"/>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-ink">{profile.full_name}</p>
            <p className="truncate text-xs text-ink-tertiary">{ROLE_TERMS[profile.role]}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        {accountHref ? (<DropdownMenuItem render={<Link href={accountHref}/>} className="cursor-pointer">
            <UserRound aria-hidden/>
            Account
          </DropdownMenuItem>) : null}
        {install ? (<DropdownMenuItem onClick={() => (install === "prompt" ? void promptInstall() : toast("Add ProximaTrax to your home screen", { description: IOS_STEPS }))} className="cursor-pointer">
            <Download aria-hidden/>
            Install app
          </DropdownMenuItem>) : null}
        <DropdownMenuItem variant="destructive" onClick={() => void signOut()} className="cursor-pointer">
          <LogOut aria-hidden/>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>);
}
