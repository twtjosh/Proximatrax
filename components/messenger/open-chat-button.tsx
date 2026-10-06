"use client";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { openChat } from "./messenger-store";

/** Any "Message" affordance: opens the messenger on this project's conversation. */
export function OpenChatButton({ projectId, className, ...props }: React.ComponentProps<"button"> & {
    projectId: string;
}) {
    return <button type="button" onClick={() => openChat(projectId)} className={cn("cursor-pointer", className)} {...props}/>;
}
