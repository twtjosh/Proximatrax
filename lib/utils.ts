import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
export function getErrorMessage(error: unknown): string {
    if (typeof error === "string")
        return error;
    if (error instanceof Error)
        return error.message;
    if (typeof error === "object" && error !== null) {
        const o = error as Record<string, unknown>;
        if (typeof o.message === "string" && o.message.length > 0) {
            return enrichDatabaseError(o.message, o.code);
        }
        if (typeof o.error_description === "string")
            return o.error_description;
        if (typeof o.details === "string" && o.details.length > 0)
            return o.details;
        if (typeof o.hint === "string" && o.hint.length > 0)
            return o.hint;
    }
    return "Something went wrong.";
}
function enrichDatabaseError(message: string, code?: unknown): string {
    const c = typeof code === "string" ? code : "";
    if (message.includes("pending_invites") ||
        message.includes("project_invitations") ||
        (c === "42P01" && message.includes("project_invitations"))) {
        return `${message} — apply migration secrets/migrations/0015_project_invitations.sql in the Supabase SQL editor, then try again.`;
    }
    if (message.includes("completed_at") ||
        message.includes("completion_statement") ||
        message.includes("completed_by")) {
        return `${message} — apply migration secrets/migrations/0020_project_formal_closure.sql in the Supabase SQL editor, then try again.`;
    }
    if (message.includes("activity_feed_action_type_check") ||
        (message.includes("project_completed") && message.includes("activity_feed"))) {
        return `${message} — apply migration secrets/migrations/0021_activity_project_completed.sql in the Supabase SQL editor, then try again.`;
    }
    if (message.includes("create_project_completed_notification")) {
        return `${message} — apply migration secrets/migrations/0020_project_formal_closure.sql in the Supabase SQL editor, then try again.`;
    }
    return message;
}
export function throwIfSupabaseError(error: unknown): void {
    if (error)
        throw new Error(getErrorMessage(error));
}
