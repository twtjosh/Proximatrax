import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { planProblem, type PlannedMilestone } from "@/lib/auto-plan";
import { asIntake, intakeCalendar, intakeMissing } from "@/lib/project-intake";
import { getErrorMessage } from "@/lib/utils";
import { createReportProject } from "@/services/report-project-service";
import { fail, people, pmOnly, readJson } from "../shared";

/**
 * The PM's reviewed plan becomes the project: the saved report, the team
 * (on the project at once, no invitations to answer), milestones and
 * assigned tasks, then the lock. The plan was editable in the browser,
 * so every rule is checked again here before anything is written.
 */
export async function POST(request: Request) {
    const ctx = await pmOnly();
    if (ctx instanceof NextResponse)
        return ctx;
    const body = await readJson<{ intake?: unknown; plan?: unknown }>(request);
    const intake = asIntake(body?.intake);
    if (!intake)
        return fail(400, "The report could not be read. Reload the page and try again.");
    const missing = intakeMissing(intake);
    if (missing)
        return fail(400, missing);
    const problem = planProblem(body?.plan, intakeCalendar(intake), intake.team);
    if (problem)
        return fail(400, problem);
    try {
        const { clients, crew } = await people(ctx.supabase);
        if (!clients.some((c) => c.id === intake.clientId) || !intake.team.every((id) => crew.some((c) => c.id === id)))
            return fail(400, "Choose the client and the team from your directory.");
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key)
            return fail(500, "Server configuration error");
        const admin = createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
        const projectId = await createReportProject(intake, body!.plan as PlannedMilestone[], ctx.user.id, ctx.supabase, admin);
        return NextResponse.json({ projectId });
    }
    catch (e) {
        return fail(400, getErrorMessage(e));
    }
}
