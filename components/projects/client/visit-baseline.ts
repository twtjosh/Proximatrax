"use client";
import * as React from "react";
import { photoCaption, readVisitBaseline, type ClientPhoto } from "@/lib/client-project";
import type { DashboardMilestone } from "@/lib/dashboard";
import type { ViewerPhoto } from "@/components/projects/shared/photo-viewer";

const subscribe = () => () => {};

/**
 * When the viewer last looked at this project before this browser session;
 * null on a first visit, on the server, or with storage blocked.
 */
export function useVisitBaseline(projectId: string): string | null {
    return React.useSyncExternalStore(subscribe, () => {
        try {
            return readVisitBaseline(projectId, window.sessionStorage, window.localStorage, new Date().toISOString());
        }
        catch {
            return null;
        }
    }, () => null);
}

/** Client photos as the viewer shows them, captioned with the work, its milestone and the approval date. */
export function toViewerPhotos(photos: ClientPhoto[], milestones: Pick<DashboardMilestone, "id" | "title">[]): ViewerPhoto[] {
    return photos.map((p) => ({ id: p.id, url: p.url, caption: photoCaption(p.taskTitle, milestones.find((m) => m.id === p.milestone_id)?.title ?? null, p.at) }));
}
