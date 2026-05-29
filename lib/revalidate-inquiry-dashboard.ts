import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/constants";
export function revalidateInquiryDashboardPaths() {
    revalidatePath(ROUTES.INQUIRIES);
    revalidatePath(ROUTES.DASHBOARD);
    revalidatePath(ROUTES.SETTINGS);
}
