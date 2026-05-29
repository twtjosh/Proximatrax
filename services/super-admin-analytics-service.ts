import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectStatus, UserRole } from "@/types/enums";
export type AnalyticsSegment = {
    label: string;
    value: number;
    color: string;
};
export type SuperAdminAnalytics = {
    projects: {
        total: number;
        active: number;
        completed: number;
        onHold: number;
        statusDistribution: AnalyticsSegment[];
        progressBuckets: {
            label: string;
            count: number;
        }[];
    };
    performance: {
        overdueTasks: number;
        overduePct: number;
        tasksCompleted: number;
        taskCompletionPct: number;
        milestonesCompleted: number;
        milestoneCompletionPct: number;
        filesThisMonth: number;
    };
    users: {
        total: number;
        active30d: number;
        new30d: number;
        clients: number;
        roleDistribution: AnalyticsSegment[];
    };
    activity: {
        dailyLogins: {
            date: string;
            count: number;
        }[];
        topUsers: {
            id: string;
            name: string;
            role: string;
            count: number;
        }[];
    };
    engagement: {
        totalInquiries: number;
        projectsCompleted: number;
        newUsers30d: number;
        newProjects30d: number;
    };
};
const STATUS_COLORS: Record<string, string> = {
    Active: "#2563eb",
    Completed: "#10b981",
    "On hold": "#f59e0b",
};
const ROLE_COLORS: Record<string, string> = {
    "Super Admin": "#6366f1",
    "Admin / PM": "#2563eb",
    Staff: "#0ea5e9",
    Client: "#f59e0b",
};
const ROLE_LABELS: Record<UserRole, string> = {
    super_admin: "Super Admin",
    project_manager: "Admin / PM",
    middleman: "Staff",
    client: "Client",
};
function daysAgoIso(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
}
function monthStartIso(): string {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}
function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}
function bucketProgress(pct: number): string {
    if (pct <= 25)
        return "0–25%";
    if (pct <= 50)
        return "26–50%";
    if (pct <= 75)
        return "51–75%";
    return "76–100%";
}
function pct(part: number, total: number): number {
    if (total <= 0)
        return 0;
    return Math.round((part / total) * 100);
}
function buildDailySeries(rows: {
    created_at: string;
}[], days: number): {
    date: string;
    count: number;
}[] {
    const map = new Map<string, number>();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        map.set(d.toISOString().slice(0, 10), 0);
    }
    for (const row of rows) {
        const key = row.created_at.slice(0, 10);
        if (map.has(key))
            map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([date, count]) => ({ date, count }));
}
export async function fetchSuperAdminAnalytics(supabase: SupabaseClient): Promise<SuperAdminAnalytics> {
    const since30d = daysAgoIso(30);
    const monthStart = monthStartIso();
    const today = todayIso();
    const [profilesRes, projectsRes, tasksRes, milestonesRes, activityRes, messagesRes, inquiriesRes, chatAttachmentsRes, taskAttachmentsRes,] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role, created_at"),
        supabase.from("projects").select("id, status, created_at"),
        supabase.from("tasks").select("project_id, stage, due_date"),
        supabase.from("milestones").select("completed"),
        supabase
            .from("activity_feed")
            .select("user_id, action_type, created_at")
            .gte("created_at", since30d),
        supabase
            .from("chat_messages")
            .select("project_id, sender_id, created_at")
            .gte("created_at", since30d),
        supabase.from("inquiries").select("id", { count: "exact", head: true }),
        supabase
            .from("chat_message_attachments")
            .select("id, created_at")
            .gte("created_at", monthStart),
        supabase
            .from("task_attachments")
            .select("id, created_at")
            .gte("created_at", monthStart),
    ]);
    const profiles = profilesRes.data ?? [];
    const projects = projectsRes.data ?? [];
    const tasks = tasksRes.data ?? [];
    const milestones = milestonesRes.data ?? [];
    const activity = activityRes.data ?? [];
    const messages = messagesRes.data ?? [];
    let active = 0;
    let completed = 0;
    let onHold = 0;
    for (const p of projects) {
        const status = p.status as ProjectStatus;
        if (status === "completed")
            completed += 1;
        else if (status === "on_hold")
            onHold += 1;
        else
            active += 1;
    }
    const statusDistribution: AnalyticsSegment[] = [
        { label: "Active", value: active, color: STATUS_COLORS.Active },
        { label: "Completed", value: completed, color: STATUS_COLORS.Completed },
        { label: "On hold", value: onHold, color: STATUS_COLORS["On hold"] },
    ].filter((s) => s.value > 0);
    const progressByProject = new Map<string, {
        total: number;
        done: number;
    }>();
    for (const t of tasks) {
        const bucket = progressByProject.get(t.project_id) ?? { total: 0, done: 0 };
        bucket.total += 1;
        if (t.stage === "done")
            bucket.done += 1;
        progressByProject.set(t.project_id, bucket);
    }
    const bucketCounts = new Map<string, number>([
        ["0–25%", 0],
        ["26–50%", 0],
        ["51–75%", 0],
        ["76–100%", 0],
    ]);
    for (const p of projects) {
        const prog = progressByProject.get(p.id);
        const pctDone = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
        const label = bucketProgress(pctDone);
        bucketCounts.set(label, (bucketCounts.get(label) ?? 0) + 1);
    }
    const progressBuckets = [...bucketCounts.entries()].map(([label, count]) => ({
        label,
        count,
    }));
    const totalTasks = tasks.length;
    const tasksCompleted = tasks.filter((t) => t.stage === "done").length;
    const overdueTasks = tasks.filter((t) => t.stage !== "done" && t.due_date && t.due_date < today).length;
    const totalMilestones = milestones.length;
    const milestonesCompleted = milestones.filter((m) => m.completed).length;
    const chatFiles = chatAttachmentsRes.error ? [] : (chatAttachmentsRes.data ?? []);
    const taskFiles = taskAttachmentsRes.error ? [] : (taskAttachmentsRes.data ?? []);
    const filesThisMonth = chatFiles.length + taskFiles.length;
    const roleCounts = new Map<string, number>();
    for (const p of profiles) {
        const label = ROLE_LABELS[(p.role as UserRole) ?? "client"] ?? "Client";
        roleCounts.set(label, (roleCounts.get(label) ?? 0) + 1);
    }
    const roleDistribution: AnalyticsSegment[] = [...roleCounts.entries()].map(([label, value]) => ({
        label,
        value,
        color: ROLE_COLORS[label] ?? "#64748b",
    }));
    const activeUserIds = new Set<string>();
    for (const row of activity) {
        if (row.user_id)
            activeUserIds.add(row.user_id);
    }
    for (const row of messages) {
        if (row.sender_id)
            activeUserIds.add(row.sender_id);
    }
    const new30d = profiles.filter((p) => p.created_at >= since30d).length;
    const clients = profiles.filter((p) => p.role === "client").length;
    const profileMap = new Map(profiles.map((p) => [p.id, { name: p.full_name, role: p.role as UserRole }]));
    const taskUpdateActions = new Set([
        "task_moved",
        "task_updated",
        "task_created",
    ]);
    const userUpdateCounts = new Map<string, number>();
    for (const row of activity) {
        if (!row.user_id || !taskUpdateActions.has(row.action_type))
            continue;
        userUpdateCounts.set(row.user_id, (userUpdateCounts.get(row.user_id) ?? 0) + 1);
    }
    const topUsers = [...userUpdateCounts.entries()]
        .map(([id, count]) => {
        const profile = profileMap.get(id);
        return {
            id,
            name: profile?.name ?? "Unknown",
            role: profile ? ROLE_LABELS[profile.role] : "User",
            count,
        };
    })
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);
    const activityForChart = [
        ...(activity as {
            created_at: string;
        }[]),
        ...(messages as {
            created_at: string;
        }[]),
    ];
    const dailyLogins = buildDailySeries(activityForChart, 30);
    const inquiryTotal = inquiriesRes.count ?? 0;
    const newProjects30d = projects.filter((p) => p.created_at >= since30d).length;
    return {
        projects: {
            total: projects.length,
            active,
            completed,
            onHold,
            statusDistribution,
            progressBuckets,
        },
        performance: {
            overdueTasks,
            overduePct: pct(overdueTasks, totalTasks),
            tasksCompleted,
            taskCompletionPct: pct(tasksCompleted, totalTasks),
            milestonesCompleted,
            milestoneCompletionPct: pct(milestonesCompleted, totalMilestones),
            filesThisMonth,
        },
        users: {
            total: profiles.length,
            active30d: activeUserIds.size,
            new30d,
            clients,
            roleDistribution,
        },
        activity: {
            dailyLogins,
            topUsers,
        },
        engagement: {
            totalInquiries: inquiryTotal,
            projectsCompleted: completed,
            newUsers30d: new30d,
            newProjects30d,
        },
    };
}
