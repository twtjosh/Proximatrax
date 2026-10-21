"use client";
import Link from "next/link";
import { ChevronRight, Download, KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Face, focusRing, stagger } from "@/components/dashboard/overview-kit";
import { signOut } from "@/components/shell/account-menu";
import { ROUTES } from "@/lib/constants";
import { IOS_STEPS, promptInstall, useInstallMode } from "@/lib/install-app";
import { cn } from "@/lib/utils";
import { personTitle } from "@/lib/vocabulary";
import type { Profile } from "@/types/database";

const row = cn("press flex min-h-14 w-full cursor-pointer items-center gap-3.5 px-4 text-left text-[15px] font-medium text-ink transition-colors duration-300 hover:bg-surface-subtle", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0");
const glyph = "grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4.5";

/**
 * Who is signed in and the few things they can do about it, laid out like a
 * phone's settings: identity up top, then grouped rows, Sign out on its own.
 * Names and roles are the administrator's to change, so nothing here edits them.
 */
export function ProfileView({ profile, email }: {
    profile: Profile;
    email: string | null;
}) {
    const install = useInstallMode();
    const title = personTitle(profile);
    return (<div className="mx-auto w-full max-w-xl pb-8">
      <h1 className="materialize text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-ink max-lg:pr-14 sm:text-[2.5rem]">Profile</h1>

      <section aria-label="Signed in as" className="materialize mt-5 flex flex-col items-center rounded-[20px] material px-6 py-7 text-center" style={stagger(1)}>
        <Face person={{ id: profile.id, name: profile.full_name, avatarUrl: profile.avatar_url, role: title }} size={88}/>
        <p className="mt-4 text-[1.375rem] font-semibold tracking-[-0.02em] text-ink">{profile.full_name}</p>
        <p className="mt-0.5 text-[15px] text-ink-secondary">{title}</p>
        {email ? <p className="mt-2 text-[13px] break-all text-ink-tertiary">{email}</p> : null}
        {profile.contact_number ? <p className="text-[13px] text-ink-tertiary tabular">{profile.contact_number}</p> : null}
      </section>

      <ul className="materialize mt-5 divide-y divide-line overflow-hidden rounded-[20px] material" style={stagger(2)}>
        {install ? (<li>
            <button type="button" onClick={() => (install === "prompt" ? void promptInstall() : toast("Add ProximaTrax to your home screen", { description: IOS_STEPS }))} className={row}>
              <span className={cn(glyph, "bg-brand-soft text-brand")} aria-hidden><Download/></span>
              <span className="flex-1">Install app</span>
              <ChevronRight className="size-4 text-ink-tertiary" aria-hidden/>
            </button>
          </li>) : null}
        <li>
          <Link href={ROUTES.FORGOT_PASSWORD} className={row}>
            <span className={cn(glyph, "bg-surface-sunken text-ink-secondary")} aria-hidden><KeyRound/></span>
            <span className="flex-1">Reset password</span>
            <ChevronRight className="size-4 text-ink-tertiary" aria-hidden/>
          </Link>
        </li>
      </ul>
      <p className="mt-2 px-4 text-[13px] text-ink-tertiary">Your name and role are managed by your administrator.</p>

      <div className="materialize mt-5 overflow-hidden rounded-[20px] material" style={stagger(3)}>
        <button type="button" onClick={() => void signOut()} className={cn(row, "justify-center gap-2 text-danger [&_svg]:size-4.5")}>
          <LogOut aria-hidden/>
          Sign out
        </button>
      </div>
    </div>);
}
