import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/landing/legal-page";
import { COMPANY_NAME } from "@/lib/vocabulary";

export const metadata: Metadata = {
    title: `Data retention policy · ${COMPANY_NAME}`,
    description: `How long ProximaTrax keeps each kind of record, why, and how it is deleted.`,
};

const PROJECT_CLOSED = "When the project manager closes the project (its completion date)";

const SECTIONS: LegalSection[] = [
    { id: "purpose", title: "Purpose", body: [
        `This policy sets out what the ProximaTrax project portal and the ${COMPANY_NAME} website keep, why, for how long, and how each record is deleted when it is no longer needed.`,
        "It follows two rules: keep only what a project needs, and do not keep personal information longer than there is a reason to.",
    ] },
    { id: "scope", title: "Scope", body: [
        "This policy covers every record ProximaTrax creates or stores, and everyone who uses it: clients, project managers, middlemen and the super admin.",
        "Those records live in three places:",
        { list: [
            "The database (Supabase, hosted in Singapore): accounts, inquiries, projects, tasks, messages, notifications and the activity log.",
            "File storage (Supabase Storage): site photos, project documents and files sent in messages.",
            "The web host (Vercel, running in Singapore): short-lived request and error logs.",
        ] },
        "Contracts, quotations, invoices and payments are not handled in ProximaTrax. They are kept outside the portal under our accounting and tax obligations, so this policy does not cover them.",
    ] },
    { id: "schedule", title: "What we keep and for how long", body: [
        "Each kind of record has its own retention period, which starts on a date the system records. Deleting one kind of record does not automatically delete the others, except where this list says so.",
        { cards: [
            { title: "Inquiries", rows: [
                ["What", "Name, email address, message, status (new, contacted, became a project, closed) and the super admin's notes."],
                ["Stored in", "The inquiries table, and which staff have opened each one."],
                ["Why", "To reply to people who want a project, and to follow up."],
                ["Starts", "The inquiry's last update (status change or note)."],
                ["Kept for", "12 months. An inquiry that became a project is not needed after that either: the person's details now sit in their client account."],
                ["Then", "Deleted by the developer at the next review. The portal has no delete button for inquiries."],
            ] },
            { title: "Client accounts", rows: [
                ["What", "Name, email address, contact number, profile photo, password (stored hashed by the sign-in service, never readable) and the last sign-in date."],
                ["Stored in", "The sign-in service (Supabase Auth) and the profiles table."],
                ["Why", "To sign in and follow your projects, including the handover record after a project closes."],
                ["Starts", "When the client's last project closes."],
                ["Kept for", "24 months, so the client can reach their handover record and photos and raise any defects or follow-up work."],
                ["Then", "The super admin deletes the account from People. The system will not delete a client who still has projects, so their projects are deleted first."],
            ] },
            { title: "Staff accounts (project managers and middlemen)", rows: [
                ["What", "The same as a client account, plus a middleman's classification (site manager, foreman or safety officer)."],
                ["Stored in", "The sign-in service and the profiles table."],
                ["Why", "To do their work on the projects they manage or have joined."],
                ["Starts", "The day the person stops working with us."],
                ["Kept for", "Up to 30 days, to hand over their work."],
                ["Then", "The super admin deletes the account. A project manager's projects must first be handed to another project manager; the system enforces this."],
            ] },
            { title: "Project records", rows: [
                ["What", "The project, its phases, tasks and checklists, task comments, status updates, team list, invitations and the handover statement."],
                ["Stored in", "The projects, milestones, tasks, task comments, project members and invitations tables."],
                ["Why", "To plan and deliver the work, and to show the client what was done."],
                ["Starts", PROJECT_CLOSED],
                ["Kept for", "24 months, the same period as the client's account."],
                ["Then", "The project's manager deletes it in Project settings › Delete project. That one step deletes every record and file in the project."],
            ] },
            { title: "Site photos and files", rows: [
                ["What", "Photos attached to tasks, documents in Files, and photos and files sent in messages."],
                ["Stored in", "File storage, with a record of each file in the database."],
                ["Why", "To show progress, as evidence of finished work, and to share documents with the client."],
                ["Starts", PROJECT_CLOSED],
                ["Kept for", "24 months, with the project. A project manager can delete a wrong or unneeded file at any time."],
                ["Then", "Deleted together with the project, files included."],
            ] },
            { title: "Messages and notifications", rows: [
                ["What", "Project messages, which messages each person has read, and in-app notifications."],
                ["Stored in", "The chat messages, read markers and notifications tables."],
                ["Why", "To let the project team and the client talk, and to tell people what needs them."],
                ["Starts", PROJECT_CLOSED],
                ["Kept for", "24 months, with the project."],
                ["Then", "Deleted with the project. Deleting a person's account also deletes the messages they sent."],
            ] },
            { title: "Activity log", rows: [
                ["What", "Who did what and when on a project: tasks added, moved, accepted or sent back (with the reason), files uploaded, status updates."],
                ["Stored in", "The activity feed table."],
                ["Why", "The project timeline and analytics, and to settle questions about what happened and when."],
                ["Starts", PROJECT_CLOSED],
                ["Kept for", "24 months, with the project."],
                ["Then", "Deleted with the project. If a person's account is deleted earlier, their entries stay but are no longer linked to them."],
            ] },
            { title: "Security and server logs", rows: [
                ["What", "Sign-in events, and the web host's request and error logs."],
                ["Stored in", "The sign-in service and the web host, not in our database."],
                ["Why", "To find faults and spot misuse."],
                ["Starts", "When the event happens."],
                ["Kept for", "The short period each provider keeps logs on our plan, usually days. We do not copy them elsewhere."],
                ["Then", "Expire on the provider's schedule. The connection address used to limit inquiries is held in memory for 10 minutes and never saved."],
            ] },
            { title: "Backups", rows: [
                ["What", "Copies of the database made by the database host."],
                ["Stored in", "Supabase, on its own schedule."],
                ["Why", "To recover from a fault or data loss."],
                ["Starts", "When each backup is made."],
                ["Kept for", "Until the host's backup cycle replaces it."],
                ["Then", "Deleted records disappear from backups as older copies expire. We restore a backup only to recover from an incident, never to bring back data deleted under this policy."],
            ] },
        ] },
    ] },
    { id: "inactive", title: "Inactive accounts", body: [
        "Signing in counts as activity, and the sign-in service records each account's last sign-in date. ProximaTrax does not deactivate accounts on its own, and it has no suspend switch. An account either has access or is deleted, and removing someone from a project ends their access to that project.",
        "At each review the developer lists accounts with no sign-in for 12 months, and the super admin decides:",
        { list: [
            "A client whose last project closed more than 24 months ago: their projects and then their account are deleted.",
            "A client who was added but never joined a project, with no sign-in for 6 months: the account is deleted.",
            "A staff member who no longer works with us: their account is deleted, after any projects they manage are handed over.",
        ] },
        "Before deleting a client's account, the project manager or super admin emails the client at least 30 days ahead, so they can save their handover record and photos.",
    ] },
    { id: "disposal", title: "Deleting, de-linking and archiving", body: [
        "Deletion is permanent and done from inside the portal wherever it can be:",
        { list: [
            "Deleting a project removes all of its records (phases, tasks, comments, messages, notifications, invitations and activity log) and its files in storage. In the portal only the project's manager can do it, after typing the project's name to confirm.",
            "Deleting an account removes the person's sign-in, profile, project memberships, the messages and task comments they wrote, the files they uploaded, their invitations and their notifications. Only the super admin can do it, and the system refuses while the person is still a project's client, or manages projects nobody has taken over.",
            "Deleting a file removes the file and its record. Project managers can delete files in their projects.",
        ] },
        "De-linking: when an account is deleted, the person's activity log entries stay, so the project's history still adds up, but they are no longer linked to anyone. This is not full anonymization: a task title or a note may still mention someone by name. Those entries are fully removed when the project is deleted.",
        "Archiving: ProximaTrax has no separate archive. A closed project stays where it is, viewable by its team and client, until its retention period ends.",
        "Exports: project managers can download the activity log as a spreadsheet and print a project report. An exported copy leaves the portal, and whoever downloads it must keep it private and delete it when it is no longer needed.",
    ] },
    { id: "holds", title: "Legal holds and exceptions", body: [
        "Deletion is paused for any record that may be needed for a dispute or complaint, legal proceedings, an audit or investigation, a security incident, or a lawful request from the authorities.",
        "The super admin tells the developer which project or account is on hold and why. It is noted in the review log, skipped at each review while the hold lasts, and goes back on the normal schedule once the matter is closed.",
    ] },
    { id: "security", title: "Security and access", body: [
        "Records are protected for as long as they are kept:",
        { list: [
            "Role-based access is enforced by the database itself, not just the screens: clients see only their own projects, middlemen only the projects they have joined, and project managers only the projects they manage.",
            "Accounts are created only by the super admin, and public sign-up is switched off. Passwords are stored hashed, and resets go through a link sent by email.",
            "All traffic is encrypted (HTTPS), and the database and server code both run in Singapore.",
            "Files are reached through long, hard-to-guess links. Anyone who has a link can open that file, so links must not be shared outside the project.",
            "Access to the database console and the service keys is limited to the people who maintain ProximaTrax.",
        ] },
    ] },
    { id: "requests", title: "Your requests", body: [
        "You can ask to see, correct or delete the personal data we hold about you. Ask your project manager or send us a message through the inquiry form on our home page; the super admin handles the request under the Data Privacy Act of 2012.",
        "The portal has no screen for editing your own profile, so we make corrections for you. If we cannot fully delete something, for example because it is on hold or part of a project that is still running, we explain why and when it will be deleted.",
    ] },
    { id: "providers", title: "Service providers", body: [
        "ProximaTrax runs on two providers, which store and process data only to run the portal:",
        { list: [
            "Supabase: database, file storage, sign-in, password-reset emails and backups.",
            "Vercel: hosting the website and portal, with short-lived request logs.",
        ] },
        "If we stop using a provider, we move the data we still need and delete the rest from that provider.",
    ] },
    { id: "roles", title: "Who does what", body: [
        { list: [
            `Super admin (the owner of ${COMPANY_NAME}): approves this policy, approves deletions at each review, asks project managers to delete projects that are due, deletes accounts, places and lifts holds, and handles personal data requests.`,
            "Project managers: delete their projects once the retention period ends, remove people who leave a project, and delete files that should not be there.",
            "Developer (who maintains ProximaTrax): runs the reviews, deletes old inquiries and any leftover files from the database console, keeps the review log, and builds the retention features.",
            "Everyone with an account: keeps their login private, uploads only what the project needs, and reports anything that looks wrong to their project manager.",
        ] },
    ] },
    { id: "implementation", title: "How the system supports this policy", body: [
        "Every retention period starts on a date the database already records: a project's completion date, an inquiry's last update, an account's last sign-in, and each record's creation date. Each step below is marked as built today or done by hand.",
        { cards: [
            { title: "Built into the portal today", rows: [
                ["Project delete", "One step removes the project, all its records and its stored files."],
                ["Account delete", "Super admin only. It refuses while the person is still a project's client, and hands a leaving project manager's projects to another project manager first."],
                ["File delete", "Project managers can delete files in their projects."],
                ["Related records", "Database rules delete a project's records with it, and unlink activity log entries when an account is deleted."],
                ["Access control", "Database rules check every read and write against the person's role and projects."],
            ] },
            { title: "Done by hand", rows: [
                ["Finding due records", "Every January and July the developer lists closed projects older than 24 months, inquiries untouched for 12 months, and accounts with no sign-in for 12 months, using the dates above."],
                ["Approval", "The super admin approves each deletion before it is done."],
                ["Inquiry delete", "The developer deletes due inquiries from the database console."],
                ["Leftover files", "Deleting an account removes the records of the files that person uploaded, but not the files themselves, so the developer clears them from storage at the review."],
                ["Review log", "The developer records what was deleted, when, and who approved it. The portal does not record deletions itself."],
            ] },
            { title: "Not built yet (proposed)", rows: [
                ["Scheduled check", "A monthly job that flags due records for the super admin, instead of listing them by hand."],
                ["Inquiry delete", "A delete action in the inquiry inbox."],
                ["File cleanup", "Removing a person's files from storage when their account is deleted."],
                ["In-app notice", "A notification to the account holder before their account is deleted."],
            ] },
        ] },
    ] },
    { id: "review", title: "Monitoring and review", body: [
        "Records are reviewed every January and July. This policy is reviewed at least once a year, and whenever ProximaTrax gains a feature that stores a new kind of data or the law changes. The date at the top shows the latest version.",
        "The 24-month and 12-month periods are our starting points for an interior fit-out business. They will be confirmed with the owner and changed if a law or contract needs a record kept longer.",
    ] },
    { id: "law", title: "Legal references", body: [
        "This policy is applied in line with Republic Act No. 10173 (the Data Privacy Act of 2012), its Implementing Rules and Regulations, and the issuances of the National Privacy Commission (privacy.gov.ph). Where a law requires a record to be kept longer, the law comes first.",
    ] },
];

export default function DataRetentionPage() {
    return <LegalPage title="Data retention policy" updated="October 23, 2026" intro="What ProximaTrax keeps, why, for how long, and how it is deleted." sections={SECTIONS}/>;
}
