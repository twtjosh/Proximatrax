"use client";
import { Printer } from "lucide-react";
import { primaryAction } from "@/components/dashboard/overview-kit";
import { cn } from "@/lib/utils";

export function PrintButton() {
    return <button type="button" onClick={() => window.print()} className={cn(primaryAction, "ml-auto h-9 px-4")}><Printer aria-hidden/>Print or save PDF</button>;
}
