"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ROUTES } from "@/lib/constants";
/**
 * The one theme provider (next-themes ignores nested ones). The public page
 * and auth screens are styled for both themes; the signed-in workspace only
 * for light, so it is forced light while the stored choice is kept.
 */
const THEMED_PATHS: string[] = [ROUTES.HOME, ROUTES.LOGIN, ROUTES.FORGOT_PASSWORD, ROUTES.UPDATE_PASSWORD];
export function ThemeProvider({ children }: {
    children: React.ReactNode;
}) {
    const themed = THEMED_PATHS.includes(usePathname());
    return (<NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme={themed ? undefined : "light"} disableTransitionOnChange>
      {children}
    </NextThemesProvider>);
}
