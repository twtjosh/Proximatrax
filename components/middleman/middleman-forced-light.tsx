"use client";
import * as React from "react";
import { ThemeProvider } from "next-themes";
export function MiddlemanForcedLight({ children, }: {
    children: React.ReactNode;
}) {
    return (<ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </ThemeProvider>);
}
