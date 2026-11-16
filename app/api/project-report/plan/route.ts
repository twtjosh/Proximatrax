import { NextResponse } from "next/server";
import { buildPlan } from "@/lib/auto-plan";
import { AiBusyError, generateJson } from "@/lib/gemini";
import { asIntake, intakeCalendar, intakeMissing, PLAN_SCHEMA, planPrompt, TOO_SHORT } from "@/lib/project-intake";
import { aiFail, fail, people, pmOnly, readJson } from "../shared";

export const maxDuration = 60;

/** Gemini drafts the work; the rules in lib/auto-plan place every date and plan who does it. Nothing is saved here. */
export async function POST(request: Request) {
    const ctx = await pmOnly();
    if (ctx instanceof NextResponse)
        return ctx;
    const intake = asIntake((await readJson<{ intake?: unknown }>(request))?.intake);
    if (!intake)
        return fail(400, "The report could not be read. Reload the page and try again.");
    const missing = intakeMissing(intake);
    if (missing)
        return fail(400, missing);
    try {
        const { crew } = await people(ctx.supabase);
        const team = crew.filter((p) => intake.team.includes(p.id));
        if (team.length !== intake.team.length)
            return fail(400, "Someone on the team is no longer a crew member. Pick the team again.");
        // An unusable draft (fewer than two milestones survive the checks) gets one more try.
        for (let attempt = 0; attempt < 2; attempt++) {
            const raw = await generateJson([{ text: planPrompt(intake, team) }], PLAN_SCHEMA);
            const plan = buildPlan(raw, intakeCalendar(intake), team);
            if (!("error" in plan))
                return NextResponse.json({ plan });
            if (plan.error === "too_short")
                return fail(422, TOO_SHORT);
        }
        throw new AiBusyError();
    }
    catch (e) {
        return aiFail(e);
    }
}
