import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/landing/footer";
import { BrandMark } from "@/components/shell/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { COMPANY_NAME } from "@/lib/vocabulary";

export const metadata: Metadata = {
    title: `Terms and conditions · ${COMPANY_NAME}`,
    description: `The terms for using the ${COMPANY_NAME} website and the ProximaTrax client portal.`,
};

const UPDATED = "October 21, 2026";

const ring = "outline-none focus-visible:ring-2 focus-visible:ring-land-accent focus-visible:ring-offset-2 focus-visible:ring-offset-land";

const SECTIONS: { id: string; title: string; body: string[] }[] = [
    { id: "about", title: "About these terms", body: [
        `These terms cover your use of this website and the ProximaTrax client portal, which ${COMPANY_NAME} ("we", "us") uses to run its interior design and fit-out projects. By using either, you agree to them.`,
        "The design and fit-out work itself is governed by your separate project agreement with us. If these terms and your project agreement disagree, the project agreement wins.",
    ] },
    { id: "accounts", title: "Your account", body: [
        "Accounts are created by our team when a project starts. There is no public sign-up.",
        "Keep your login details to yourself. You are responsible for what happens under your account, so tell your project manager straight away if you think someone else has used it.",
        "We may suspend an account that is misused, and we may close accounts after a project ends.",
    ] },
    { id: "inquiries", title: "Inquiries", body: [
        "Sending an inquiry does not create a contract or commit either of us to anything. We reply by email to talk through scope, timeline and next steps.",
        "Quotes and schedules only become binding once they are confirmed in a signed project agreement.",
    ] },
    { id: "project-information", title: "Project information", body: [
        "Milestones, due dates, progress and site photos in the portal are there to keep you informed. Due dates are planned targets and can change; when one moves, the portal shows the new date.",
        "Work counts as accepted only once your project manager approves it. Portal records do not replace your project agreement, quotations or official billing documents.",
    ] },
    { id: "acceptable-use", title: "Acceptable use", body: [
        "Do not try to reach projects or accounts that are not yours, interfere with the portal or how it runs, upload anything unlawful, or share photos or details of other clients' projects.",
    ] },
    { id: "ownership", title: "Designs and content", body: [
        `Designs, drawings and site photos made by ${COMPANY_NAME} stay ours unless your project agreement says otherwise. You may use them for your own project.`,
        "Anything you upload stays yours. You let us use it as far as we need to deliver your project.",
    ] },
    { id: "privacy", title: "Your personal data", body: [
        "We collect the name, email address and project details you give us, along with activity on your account, to run your project and answer your inquiries. We do not sell your personal data.",
        "We handle personal data in line with the Data Privacy Act of 2012 (Republic Act No. 10173). To see or correct the data we hold about you, ask your project manager or send us a message through the inquiry form.",
    ] },
    { id: "availability", title: "Availability", body: [
        "We work to keep the portal available but cannot promise uninterrupted access. It may be briefly unavailable during maintenance or updates.",
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
    return (<div className="landing min-h-screen bg-land text-land-ink">
      <header className="border-b border-land-line">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:h-18 sm:px-6">
          <Link href={ROUTES.HOME} className={cn("flex items-center gap-2.5 rounded-xl py-1 pr-1.5", ring)}>
            <BrandMark className="size-8 sm:size-9"/>
            <span className="text-[17px] font-semibold tracking-[-0.02em] whitespace-nowrap sm:text-lg">{COMPANY_NAME}</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 pt-14 pb-24 sm:px-6 sm:pt-20 sm:pb-32">
        <Link href={ROUTES.HOME} className={cn("group/back inline-flex items-center gap-1.5 rounded text-sm font-medium text-land-ink-2 transition-colors hover:text-land-ink", ring)}>
          <ArrowLeft className="size-4 transition-transform duration-300 ease-spring group-hover/back:-translate-x-0.5" aria-hidden/>
          Back to home
        </Link>
        <h1 className="mt-8 text-[clamp(2.25rem,4.6vw,3.5rem)] leading-[1.05] font-semibold tracking-[-0.035em]">Terms and conditions</h1>
        <p className="mt-4 text-sm text-land-ink-3">Last updated {UPDATED}</p>

        <div className="mt-14 grid gap-12 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-20">
          <nav aria-label="On this page" className="max-lg:hidden">
            <ol className="sticky top-8 space-y-2.5 border-l border-land-line text-sm">
              {SECTIONS.map((s, i) => (<li key={s.id}>
                  <a href={`#${s.id}`} className={cn("-ml-px flex gap-3 border-l border-transparent pl-4 text-land-ink-2 transition-colors hover:border-copper hover:text-land-ink", ring)}>
                    <span className="w-5 text-land-ink-3 tabular">{String(i + 1).padStart(2, "0")}</span>
                    {s.title}
                  </a>
                </li>))}
            </ol>
          </nav>
          <div className="max-w-2xl">
            {SECTIONS.map((s, i) => (<section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-8 border-t border-land-line py-10 first:border-t-0 first:pt-0">
                <h2 id={`${s.id}-title`} className="flex items-baseline gap-3 text-xl font-semibold tracking-[-0.02em]">
                  <span className="text-sm font-medium text-brand tabular">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                {s.body.map((p) => (<p key={p} className="mt-4 text-[15px] leading-relaxed text-land-ink-2">{p}</p>))}
              </section>))}
          </div>
        </div>
      </main>

      <Footer />
    </div>);
}
