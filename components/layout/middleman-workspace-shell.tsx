import type { ReactNode } from "react";
import { MiddlemanHeader } from "@/components/layout/middleman-header";
import { MiddlemanSidebar } from "@/components/layout/middleman-sidebar";
import { MiddlemanForcedLight } from "@/components/middleman/middleman-forced-light";
import type { Profile } from "@/types/database";
type MiddlemanWorkspaceShellProps = {
    profile: Profile;
    children: ReactNode;
};
export function MiddlemanWorkspaceShell({ profile, children, }: MiddlemanWorkspaceShellProps) {
    return (<MiddlemanForcedLight>
      <div className="h-svh overflow-hidden bg-[#f8fafc] text-slate-900">
        <div className="flex h-full min-h-0">
          <MiddlemanSidebar profile={profile}/>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <MiddlemanHeader profile={profile}/>
            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5 md:p-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </MiddlemanForcedLight>);
}
