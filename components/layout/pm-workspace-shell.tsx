import type { ReactNode } from "react";
import { PmHeader } from "@/components/layout/pm-header";
import { PmSidebar } from "@/components/layout/pm-sidebar";
import type { Profile } from "@/types/database";
type PmWorkspaceShellProps = {
    profile: Profile;
    children: ReactNode;
};
export function PmWorkspaceShell({ profile, children }: PmWorkspaceShellProps) {
    return (<div className="h-svh overflow-hidden bg-[#e8edf4] bg-[radial-gradient(ellipse_90%_60%_at_80%_-10%,rgba(217,119,6,0.12),transparent_50%),radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(30,41,59,0.08),transparent_55%)]">
      <div className="flex h-full min-h-0">
        <PmSidebar profile={profile}/>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <PmHeader profile={profile}/>
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
            {children}
          </main>
        </div>
      </div>
    </div>);
}
