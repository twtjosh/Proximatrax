import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/landing/legal-page";
import { COMPANY_NAME } from "@/lib/vocabulary";

export const metadata: Metadata = {
    title: `Terms and conditions · ${COMPANY_NAME}`,
    description: `The terms for using the ${COMPANY_NAME} website and the ProximaTrax project portal.`,
};

const SECTIONS: LegalSection[] = [
    { id: "about", title: "About these terms", body: [
        `These terms cover this website, its inquiry form and ProximaTrax, the project portal ${COMPANY_NAME} ("we", "us") uses to run its interior design and fit-out projects. By using any of them, you agree to these terms.`,
        "The design and fit-out work itself is governed by your separate project agreement with us. If these terms and your project agreement disagree, the project agreement wins.",
    ] },
    { id: "who", title: "Who uses the portal", body: [
        "ProximaTrax has four kinds of account, and each one sees only what its work needs:",
        { list: [
            "Clients follow their own projects: phases and due dates, work once it is accepted, approved site photos, shared documents, status updates and messages with their project team.",
            "Project managers plan and run the projects they manage: they invite the client and crew, add tasks, review and accept work, share files and post status updates.",
            "Middlemen (our site managers, foremen and safety officers) see the projects they have joined, take and update tasks, upload site photos and submit work for review.",
            `The super admin (the owner of ${COMPANY_NAME}) adds and removes accounts, answers inquiries and can see every project.`,
        ] },
    ] },
    { id: "accounts", title: "Your account", body: [
        "Accounts are created by our super admin. There is no public sign-up. If you forget your password, you can reset it from the login page with a link sent to your email.",
        "Keep your login details to yourself. You are responsible for what happens under your account, so tell your project manager straight away if you think someone else has used it.",
        "We may remove you from a project or delete an account that is misused. Accounts are deleted when they are no longer needed, as set out in our Data Retention Policy.",
    ] },
    { id: "inquiries", title: "Inquiries", body: [
        "The inquiry form asks for your name, email address and a message. To keep spam out, it accepts a few inquiries at a time from the same email address or connection.",
        "Sending an inquiry does not create a contract or commit either of us to anything. We reply by email to talk through scope, timeline and next steps. Quotes and schedules only become binding once they are confirmed in a signed project agreement.",
    ] },
    { id: "invitations", title: "Joining a project", body: [
        "Your project manager invites you to a project, and you see it once you accept the invitation. The project manager can remove someone from a project, and that person then loses access to it.",
    ] },
    { id: "project-information", title: "Project information", body: [
        "Phases, due dates, progress, status updates and site photos are there to keep you informed. Due dates are planned targets and can change; when one moves, the portal shows the new date.",
        "Work counts as accepted only once your project manager approves it, and only accepted work and approved photos are shown to the client. When a project is closed, the client keeps its handover record.",
        "Portal records do not replace your project agreement, quotations or official billing documents. The portal does not handle payments.",
    ] },
    { id: "uploads", title: "Messages and uploads", body: [
        "Messages are shared with the project team on that project. Photos and documents you upload are kept with the project they belong to.",
        "Each uploaded file has its own long, hard-to-guess link. Anyone who has that link can open the file, so do not forward file links outside your project.",
        "Upload only what the project needs. Do not upload anything unlawful, or anything you do not have the right to share.",
    ] },
    { id: "acceptable-use", title: "Acceptable use", body: [
        "Do not try to reach projects or accounts that are not yours, interfere with the portal or how it runs, send automated or bulk inquiries, or share photos or details of other clients' projects.",
    ] },
    { id: "ownership", title: "Designs and content", body: [
        `Designs, drawings and site photos made by ${COMPANY_NAME} stay ours unless your project agreement says otherwise. You may use them for your own project.`,
        "Anything you upload stays yours. You let us use it as far as we need to deliver your project.",
    ] },
    { id: "privacy", title: "Your personal data", body: [
        "We collect your name, email address, contact number and profile photo, what you send through the inquiry form, and what you do on your projects (tasks, messages, uploads and the activity log), to run your project and answer your inquiries. We do not sell your personal data.",
        "We handle personal data in line with the Data Privacy Act of 2012 (Republic Act No. 10173). How long each kind of record is kept, and how it is deleted, is set out in our Data Retention Policy.",
        "To see, correct or delete the data we hold about you, ask your project manager or send us a message through the inquiry form.",
    ] },
    { id: "availability", title: "Availability", body: [
        "We work to keep the portal available but cannot promise uninterrupted access. It may be briefly unavailable during maintenance or updates. Changes need an internet connection; if yours drops, the portal tells you so you can try again.",
    ] },
    { id: "liability", title: "Liability", body: [
        "As far as the law allows, we are not liable for indirect or consequential loss arising from your use of the website or portal. Nothing in these terms limits liability that the law does not allow us to limit.",
    ] },
    { id: "changes", title: "Changes to these terms", body: [
        "We may update these terms. The date at the top shows the latest version. If a change is significant we will tell you in the portal or by email, and continuing to use the portal after that means you accept it.",
    ] },
    { id: "law", title: "Governing law", body: [
        "These terms are governed by the laws of the Republic of the Philippines.",
    ] },
    { id: "contact", title: "Questions", body: [
        "If you have a question about these terms, ask your project manager or send us a message through the inquiry form on our home page.",
    ] },
];

export default function TermsPage() {
    return <LegalPage title="Terms and conditions" updated="October 23, 2026" sections={SECTIONS}/>;
}
