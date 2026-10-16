import { deliveryPhrase, type Person } from "@/lib/analytics";
import type { TeamMember } from "@/lib/data/project-context";
import { cn } from "@/lib/utils";

/** `Face` takes a team member; analytics people have no project role. */
export const asMember = (p: Person): TeamMember => ({ ...p, role: "" });

/** One dot per delivered project, oldest first: green on time or early, red late. Decorative; callers state the count. */
export function DeliveryDots({ dots, size = 12 }: { dots: { title: string; late: number }[]; size?: number }) {
    return (<span className="flex flex-wrap gap-1.5" aria-hidden>
      {dots.map((d, i) => (<span key={i} title={`${d.title}: ${deliveryPhrase(d.late)}`} className={cn("block shrink-0 rounded-full", d.late > 0 ? "bg-stage-late" : "bg-stage-done")} style={{ width: size, height: size }}/>))}
    </span>);
}
