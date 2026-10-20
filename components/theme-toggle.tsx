"use client";
import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

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

    // Styled for the landing page's top bar, its only user.
    return (
        <button
            type="button"
            onClick={handleToggle}
            aria-label={
                mounted
                    ? `Switch to ${isDark ? "light" : "dark"} mode`
                    : "Toggle theme"
            }
            className="press relative grid size-11 place-items-center overflow-hidden rounded-full max-sm:size-10 text-land-ink-2 outline-none hover:bg-land-ink/6 hover:text-land-ink focus-visible:ring-2 focus-visible:ring-land-accent"
        >
            <Sun
                aria-hidden="true"
                className={`absolute size-[18px] transition-[transform,opacity] duration-500 ease-spring ${
                    isDark
                        ? "-rotate-90 scale-0 opacity-0"
                        : "rotate-0 scale-100 opacity-100"
                }`}
            />
            <Moon
                aria-hidden="true"
                className={`absolute size-[18px] transition-[transform,opacity] duration-500 ease-spring ${
                    isDark
                        ? "rotate-0 scale-100 opacity-100"
                        : "rotate-90 scale-0 opacity-0"
                }`}
            />
        </button>
    );
}
