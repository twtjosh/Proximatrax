import { Download } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import { formatDate } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { publicTaskAttachmentUrl } from "@/services/task-attachment-service";
import type { ProjectFile } from "@/types/database";

const FOLDER: Record<ProjectFile["folder"], string> = { drawings: "Drawing", designs: "Design", contracts: "Contract or permit", other: "Document" };

/** Drawings, designs and papers the project manager shared, to open or keep. */
export function SharedDocuments({ files }: {
    files: ProjectFile[];
}) {
    if (files.length === 0)
        return null;
    return (<section aria-labelledby="shared-docs" className="materialize rounded-[20px] material">
      <h2 id="shared-docs" className="px-5 pt-5 pb-2 text-[17px] font-semibold tracking-[-0.016em] sm:px-6">Documents <span className="font-medium text-ink-tertiary tabular">{files.length}</span></h2>
      <ul className="pb-2">
        {files.map((f) => (<li key={f.id} className="flex items-center gap-3 border-t border-line px-5 py-3 first:border-t-0 sm:px-6">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-[10px] font-bold text-ink-secondary">{f.file_name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE"}</span>
            <a href={publicTaskAttachmentUrl(f.storage_path)} target="_blank" rel="noopener noreferrer" className={cn("min-w-0 flex-1 rounded-sm", focusRing)}>
              <span className="block truncate text-sm font-medium text-ink hover:underline">{f.file_name}</span>
              <span className="block text-xs text-ink-tertiary">{FOLDER[f.folder]} · shared {formatDate((f.shared_with_client_at ?? f.created_at).slice(0, 10), { month: "short", day: "numeric" })}</span>
            </a>
            <a href={`${publicTaskAttachmentUrl(f.storage_path)}?download=${encodeURIComponent(f.file_name)}`} aria-label={`Download ${f.file_name}`} className={cn("grid size-9 shrink-0 place-items-center rounded-full text-ink-tertiary hover:bg-surface-sunken hover:text-ink", focusRing)}><Download className="size-4" aria-hidden/></a>
          </li>))}
      </ul>
    </section>);
}
