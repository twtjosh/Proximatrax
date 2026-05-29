"use client";
import { triageCounts } from "@/lib/inquiry-triage";
import type { Inquiry } from "@/types/database";
type InquiryQueueSummaryProps = {
    inquiries: Inquiry[];
    viewedInquiryIds: string[];
};
export function InquiryQueueSummary({ inquiries, viewedInquiryIds }: InquiryQueueSummaryProps) {
    const rows = inquiries.map((i) => ({
        id: i.id,
        status: i.status,
        name: i.name,
        email: i.email,
        created_at: i.created_at,
    }));
    const { totalUnopened } = triageCounts(rows, viewedInquiryIds);
    return (<p className="text-sm text-zinc-600 dark:text-zinc-400">
      <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {totalUnopened}
      </span>{" "}
      unread
    </p>);
}
