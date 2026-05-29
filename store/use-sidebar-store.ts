import { create } from "zustand";
type SidebarState = {
    isCollapsed: boolean;
    toggleSidebar: () => void;
    setCollapsed: (isCollapsed: boolean) => void;
};
export const useSidebarStore = create<SidebarState>((set) => ({
    isCollapsed: false,
    toggleSidebar: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
    setCollapsed: (isCollapsed) => set({ isCollapsed }),
}));
