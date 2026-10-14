import { logSentence } from "@/lib/project-log";
import type { ActivityWithActor } from "@/services/activity-service";

/** "Ana accepted “Pour the footing”": the project log's sentence, with who did it. */
export function formatActivitySentence(row: ActivityWithActor): string {
    return `${row.actor?.full_name?.split(" ")[0] ?? "Someone"} ${logSentence(row)}`;
}
