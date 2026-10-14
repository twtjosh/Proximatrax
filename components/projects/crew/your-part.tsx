import { formatDate, isoDateIn } from "@/lib/dashboard";
import type { ProjectWithRelations } from "@/services/project-service";

const long = (iso: string) => formatDate(iso, { month: "short", day: "numeric", year: "numeric" });

/** A closed project, from the viewer's side: what they delivered and the PM's closing words. */
export function YourPart({ project, accepted, photos }: {
    project: ProjectWithRelations;
    accepted: number;
    photos: number;
}) {
    return (<section aria-labelledby="your-part" className="materialize max-w-2xl rounded-[24px] material p-6 sm:p-8">
      <p className="text-xs font-medium text-success">Completed{project.completed_at ? ` · ${long(isoDateIn(project.completed_at))}` : ""}</p>
      <h2 id="your-part" className="mt-2 text-[1.5rem] leading-tight font-semibold tracking-[-0.025em] text-balance text-ink">Your part in {project.title}</h2>
      {project.completion_statement ? <p className="mt-4 rounded-2xl bg-surface-subtle p-4 text-[15px] leading-relaxed text-ink-secondary">{project.completion_statement}</p> : null}
      <dl className="mt-6 grid grid-cols-3 gap-3 text-sm">
        <div><dt className="text-xs text-ink-tertiary">Accepted</dt><dd className="mt-0.5 text-lg font-semibold text-ink tabular">{accepted}</dd></div>
        <div><dt className="text-xs text-ink-tertiary">Photos</dt><dd className="mt-0.5 text-lg font-semibold text-ink tabular">{photos}</dd></div>
        <div><dt className="text-xs text-ink-tertiary">Dates</dt><dd className="mt-0.5 font-medium text-ink">{formatDate(project.start_date, { month: "short", day: "numeric" })} – {formatDate(project.end_date, { month: "short", day: "numeric" })}</dd></div>
      </dl>
    </section>);
}
