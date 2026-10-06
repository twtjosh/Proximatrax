"use client";
import * as React from "react";
import { ThemeProvider } from "next-themes";
/**
 * The signed-in workspace runs on the light tokens (the PM Overview layers
 * the Night ground on top; see WorkspaceShell), never the shadcn `.dark` theme.
 * The public page keeps its own theme toggle.
 */
export function WorkspaceTheme({ children }: {
    children: React.ReactNode;
}) {
    return (<ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </ThemeProvider>);
}
