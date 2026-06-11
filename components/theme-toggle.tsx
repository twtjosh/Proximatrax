"use client";
import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

type ViewTransitionDocument = Document & {
    startViewTransition?: (callback: () => void) => {
        ready: Promise<void>;
        finished: Promise<void>;
        updateCallbackDone: Promise<void>;
    };
};

export function ThemeToggle() {
    const { setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const isDark = mounted && resolvedTheme === "dark";

    const handleToggle = React.useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            const next = resolvedTheme === "dark" ? "light" : "dark";

            const doc = document as ViewTransitionDocument;
            const prefersReducedMotion = window.matchMedia(
                "(prefers-reduced-motion: reduce)",
            ).matches;

            if (!doc.startViewTransition || prefersReducedMotion) {
                setTheme(next);
                return;
            }

            const button = event.currentTarget;
            const rect = button.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            const maxRadius = Math.hypot(
                Math.max(x, window.innerWidth - x),
                Math.max(y, window.innerHeight - y),
            );

            const root = document.documentElement;
            root.style.setProperty("--theme-reveal-x", `${x}px`);
            root.style.setProperty("--theme-reveal-y", `${y}px`);
            root.style.setProperty("--theme-reveal-radius", `${maxRadius}px`);
            root.dataset.themeTransition = "active";

            const transition = doc.startViewTransition!(() => {
                setTheme(next);
            });

            transition.finished.finally(() => {
                root.style.removeProperty("--theme-reveal-x");
                root.style.removeProperty("--theme-reveal-y");
                root.style.removeProperty("--theme-reveal-radius");
                delete root.dataset.themeTransition;
            });
        },
        [resolvedTheme, setTheme],
    );

    return (
        <Button
            variant="outline"
            size="icon"
            onClick={handleToggle}
            aria-label={
                mounted
                    ? `Switch to ${isDark ? "light" : "dark"} mode`
                    : "Toggle theme"
            }
            className="group relative h-9 w-9 overflow-hidden border-slate-200 bg-white transition-colors duration-300 hover:border-amber-300/70 hover:bg-amber-50/60 dark:border-white/12 dark:bg-white/5 dark:text-white dark:hover:border-amber-400/40 dark:hover:bg-white/10"
        >
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-md bg-[radial-gradient(circle_at_center,rgba(217,119,6,0.22),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
            <Sun
                aria-hidden="true"
                className={`absolute h-[1.15rem] w-[1.15rem] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] ${
                    isDark
                        ? "-rotate-90 scale-0 opacity-0"
                        : "rotate-0 scale-100 opacity-100"
                }`}
            />
            <Moon
                aria-hidden="true"
                className={`absolute h-[1.15rem] w-[1.15rem] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] ${
                    isDark
                        ? "rotate-0 scale-100 opacity-100"
                        : "rotate-90 scale-0 opacity-0"
                }`}
            />
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
