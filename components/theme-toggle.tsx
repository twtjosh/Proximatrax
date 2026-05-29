"use client";
import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
export function ThemeToggle() {
    const { setTheme, theme } = useTheme();
    return (<Button variant="outline" size="icon" className="h-9 w-9 border-slate-200 bg-white dark:border-white/12 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"/>
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"/>
      <span className="sr-only">Toggle theme</span>
    </Button>);
}
