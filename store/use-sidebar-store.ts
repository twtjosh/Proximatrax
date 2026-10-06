import { create } from "zustand";
import { persist } from "zustand/middleware";
type SidebarState = {
    isCollapsed: boolean;
    toggleSidebar: () => void;
    setCollapsed: (isCollapsed: boolean) => void;
};
/**
 * Desktop sidebar width preference. Hydration is manual (see WorkspaceShell)
 * so the server render and the first client render agree.
 */
export const useSidebarStore = create<SidebarState>()(persist((set) => ({
    isCollapsed: false,
    toggleSidebar: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
    setCollapsed: (isCollapsed) => set({ isCollapsed }),
}), {
    name: "ptx-sidebar",
    skipHydration: true,
}));
