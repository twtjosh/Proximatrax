"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Building2, CalendarRange, CheckCircle2, FolderKanban, Inbox, MessageSquareMore, Send, ShieldCheck, } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
const easeOutExpo = [0.22, 1, 0.36, 1] as const;
const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.65, ease: easeOutExpo },
};
const capabilities = [
    {
        label: "Project Tracking",
        title: "Real-time visibility on every active engagement",
        description: "Track project status, milestones, and timelines from planning through completion — all in one shared workspace.",
        icon: FolderKanban,
    },
    {
        label: "Timeline",
        title: "Gantt-powered milestone management",
        description: "Plan deliverables, adjust schedules, and keep every stakeholder aligned with interactive timeline views.",
        icon: CalendarRange,
    },
    {
        label: "Communication",
        title: "Direct channels between your team and clients",
        description: "Real-time project chat, activity feeds, and status updates keep everyone informed without scattered messages.",
        icon: MessageSquareMore,
    },
    {
        label: "Access Control",
        title: "Role-based views for management, staff, and clients",
        description: "Each user sees exactly what they need — from full project oversight to a simplified client progress portal.",
        icon: ShieldCheck,
    },
];
function NavBar() {
    return (<motion.nav initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, ease: easeOutExpo }} className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/80 dark:border-white/8 dark:bg-[#050b14]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-200/50 bg-amber-50/50 transition-colors group-hover:border-amber-300/50 dark:border-[#d97706]/30 dark:bg-[#d97706]/10 dark:group-hover:border-[#d97706]/50">
            <Building2 className="h-5 w-5 text-[#d97706] transition-transform group-hover:scale-110 dark:text-[#f3b35d]"/>
          </div>
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d97706]">
              AEG Fashion
            </div>
            <div className="font-heading text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              ProximaTrax
            </div>
          </div>
        </Link>

        <div className="hidden items-center gap-10 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 md:flex">
          <a href="#about" className="transition-colors hover:text-slate-900 dark:hover:text-white">
            About
          </a>
          <a href="#capabilities" className="transition-colors hover:text-slate-900 dark:hover:text-white">
            Capabilities
          </a>
          <a href="#inquiries" className="transition-colors hover:text-slate-900 dark:hover:text-white">
            Inquiries
          </a>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/login" prefetch={false} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:shadow-none dark:hover:bg-white/10 dark:hover:text-white">
            Log In
          </Link>
        </div>
      </div>
    </motion.nav>);
}
function HeroSection() {
    return (<section className="relative overflow-hidden border-b border-slate-200/80 bg-slate-50/50 pt-32 pb-24 dark:border-white/8 dark:bg-[#050b14]">
      <div className="bg-grid opacity-[0.03] dark:opacity-10"/>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.05),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.03),transparent_40%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.15),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_40%)]"/>

      <div className="relative mx-auto grid max-w-[1280px] gap-16 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="pt-8">
          <motion.h1 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.18, ease: easeOutExpo }} className="max-w-4xl font-heading text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-slate-900 sm:text-6xl lg:text-[5.5rem] dark:text-white">
            Transforming spaces with precision and transparency.
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.32 }} className="mt-8 max-w-2xl border-l-2 border-[#d97706] pl-6 text-lg leading-relaxed text-slate-600 sm:text-xl dark:text-slate-300/90">
            AEG Fashion delivers interior design and construction services backed by
            ProximaTrax — our centralized project management platform that keeps every
            milestone, update, and decision visible to you in real time.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.44 }} className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a href="#inquiries" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#d97706] px-8 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-white shadow-[0_4px_14px_rgba(217,119,6,0.25)] transition-all hover:bg-[#b46305] hover:shadow-[0_6px_20px_rgba(217,119,6,0.3)] hover:-translate-y-0.5 dark:text-slate-950">
              Submit an Inquiry
              <ArrowRight className="h-4 w-4"/>
            </a>
            <a href="#capabilities" className="inline-flex h-12 items-center justify-center rounded-md border border-slate-200 bg-white px-8 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:shadow-none dark:hover:bg-white/10 dark:hover:text-white">
              What We Offer
            </a>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.56 }} className="mt-14 grid gap-5 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/60 bg-white/60 p-5 shadow-sm backdrop-blur-sm dark:border-white/6 dark:bg-white/2">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d97706]">
                Transparency
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Clients see real-time progress on milestones, tasks, and updates.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/60 bg-white/60 p-5 shadow-sm backdrop-blur-sm dark:border-white/6 dark:bg-white/2">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d97706]">
                Communication
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Direct project channels between your team and AEG staff.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/60 bg-white/60 p-5 shadow-sm backdrop-blur-sm dark:border-white/6 dark:bg-white/2">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d97706]">
                Quality
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Every detail tracked from design concept to final handover.
              </p>
            </div>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, x: 24, rotateY: 5 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} transition={{ duration: 0.8, delay: 0.3, ease: easeOutExpo }} className="relative perspective-[1000px]">
          <div className="absolute -inset-4 rounded-2xl bg-linear-to-tr from-amber-100/50 to-transparent opacity-50 blur-2xl dark:from-[#d97706]/20 dark:to-transparent dark:opacity-100"/>
          <div className="relative rounded-xl border border-slate-200 bg-white p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-[#0b1422] dark:shadow-[0_30px_90px_rgba(0,0,0,0.4)] transform-gpu transition-transform hover:-translate-y-1 hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5 dark:border-white/10">
              <div>
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d97706]">
                  Client View
                </div>
                <div className="mt-1.5 font-heading text-xl font-bold text-slate-900 dark:text-white">
                  Your Project Dashboard
                </div>
              </div>
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                In Progress
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-5 dark:border-white/6 dark:bg-[#101b2c]">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Milestones
                </div>
                <div className="mt-4 space-y-4">
                  {[
            ["Site Survey", "Completed", "100%"],
            ["Design Review", "In Progress", "72%"],
            ["Final Fit-Out", "Upcoming", "18%"],
        ].map(([name, status, width]) => (<div key={name}>
                      <div className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
                        <span>{name}</span>
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          {status}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                        <div className="h-full rounded-full bg-[#d97706] shadow-[0_0_10px_rgba(217,119,6,0.5)] transition-all duration-1000 ease-out" style={{ width }}/>
                      </div>
                    </div>))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50 p-5 dark:border-white/6 dark:bg-[#101b2c]">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Recent Activity
                </div>
                <div className="mt-4 space-y-4">
                  {[
            "Design mockup approved by client",
            "Progress photos uploaded — ceiling scope",
            "Milestone moved to review stage",
        ].map((entry) => (<div key={entry} className="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#d97706]"/>
                      <span className="leading-relaxed">{entry}</span>
                    </div>))}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-amber-100 bg-amber-50/50 p-5 dark:border-[#d97706]/20 dark:bg-[#d97706]/5">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d97706]">
                  Client Portal
                </div>
                <ShieldCheck className="h-4 w-4 text-[#d97706]"/>
              </div>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                As a client, you get a secure portal to track milestone progress,
                view approved files, and communicate directly with your project manager.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>);
}
function CapabilitiesSection() {
    return (<section id="capabilities" className="border-b border-slate-200/80 bg-white py-28 dark:border-white/8 dark:bg-[#0b1422]">
      <div className="mx-auto max-w-[1280px] px-6">
        <motion.div {...reveal} className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d97706]">
              Capabilities
            </div>
            <h2 className="mt-4 max-w-md font-heading text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              How AEG manages your project with clarity.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300/80">
            Every AEG project is managed through ProximaTrax — combining task tracking,
            milestone planning, media handling, and direct communication in one workspace.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {capabilities.map(({ label, title, description, icon: Icon }, index) => (<motion.article key={label} {...reveal} transition={{ ...reveal.transition, delay: index * 0.08 }} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-white/8 dark:bg-[#08111f]/50 dark:hover:border-[#d97706]/40 dark:hover:bg-[#08111f]">
                <div className="absolute inset-0 bg-linear-to-br from-amber-500/3 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-[#d97706]/10"/>
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d97706]">
                      {label}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-2 transition-colors group-hover:border-amber-200 group-hover:bg-amber-50 dark:border-white/10 dark:bg-white/5 dark:group-hover:border-[#d97706]/30 dark:group-hover:bg-[#d97706]/10">
                      <Icon className="h-5 w-5 text-slate-400 transition-colors group-hover:text-[#d97706] dark:text-slate-500 dark:group-hover:text-[#f3b35d]"/>
                    </div>
                  </div>
                  <h3 className="mt-12 font-heading text-2xl font-bold leading-tight text-slate-900 transition-colors group-hover:text-slate-950 dark:text-white">
                    {title}
                  </h3>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {description}
                  </p>
                </div>
              </motion.article>))}
        </div>
      </div>
    </section>);
}
function AboutSection() {
    return (<section id="about" className="border-b border-slate-200/80 bg-slate-50/50 py-28 text-slate-900 dark:border-white/8 dark:bg-[#050b14]">
      <div className="mx-auto max-w-[1280px] px-6">
        <motion.div {...reveal} className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d97706]">
              About AEG Fashion
            </div>
            <h2 className="mt-4 max-w-lg font-heading text-4xl font-bold tracking-tight sm:text-5xl dark:text-white">
              Interior design and construction, managed with precision.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-600 dark:text-slate-300/80">
              AEG Fashion is an interior design and construction firm. We handle projects
              from concept to completion — site surveys, design planning, fit-out execution,
              and final handover.
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-6 top-8 bottom-8 w-px bg-linear-to-b from-slate-200 via-slate-200 to-transparent dark:from-white/10 dark:via-white/10 hidden md:block"/>
            <div className="grid gap-6">
              {[
            {
                step: "01",
                title: "Design & Planning",
                text: "We work with you to define the project scope, create design mockups, and establish a clear timeline with milestones.",
            },
            {
                step: "02",
                title: "Execution & Tracking",
                text: "Our team executes the fit-out with full visibility — progress photos, status updates, and milestone tracking accessible through your client portal.",
            },
            {
                step: "03",
                title: "Communication & Handover",
                text: "Stay connected through direct project chat. Review progress, approve designs, and receive your completed space on schedule.",
            },
        ].map((item, index) => (<motion.div key={item.step} {...reveal} transition={{ ...reveal.transition, delay: index * 0.1 }} className="group relative grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md md:grid-cols-[84px_1fr] dark:border-white/8 dark:bg-[#0b1422] dark:hover:border-white/15">
                  <div className="relative z-10 flex flex-col items-start md:items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-amber-50 font-mono text-sm font-bold text-[#d97706] shadow-sm transition-colors group-hover:bg-[#d97706] group-hover:text-white dark:border-[#d97706]/30 dark:bg-[#d97706]/10 dark:text-[#f3b35d] dark:group-hover:bg-[#d97706] dark:group-hover:text-white">
                      {item.step}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-heading text-2xl font-bold text-slate-900 dark:text-white">{item.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {item.text}
                    </p>
                  </div>
                </motion.div>))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>);
}
function InquirySection() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/inquiries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, message }),
            });
            if (!res.ok)
                throw new Error("Failed");
        }
        catch {
        }
        setSubmitted(true);
        setIsSubmitting(false);
    }
    return (<section id="inquiries" className="border-b border-slate-200/80 bg-white py-28 dark:border-white/8 dark:bg-[#0b1422]">
      <div className="mx-auto max-w-[1280px] px-6">
        <motion.div {...reveal} className="grid gap-14 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d97706]">
              Inquiries
            </div>
            <h2 className="mt-4 max-w-lg font-heading text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              Have a project in mind? Let&apos;s talk.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-600 dark:text-slate-300/80">
              Whether you&apos;re planning a new fit-out, renovation, or interior
              redesign, reach out and our team will get back to you to discuss scope,
              timeline, and next steps.
            </p>

            <div className="mt-10 space-y-5">
              {[
            "Interior design consultation",
            "Commercial and retail fit-out",
            "Renovation and remodeling",
            "Project timeline",
        ].map((item) => (<div key={item} className="flex items-center gap-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 dark:bg-[#d97706]/10">
                    <CheckCircle2 className="h-4 w-4 text-[#d97706]"/>
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item}</span>
                </div>))}
            </div>
          </div>

          <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }}>
            {submitted ? (<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-12 text-center shadow-sm dark:border-emerald-500/20 dark:bg-[#08111f]">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400"/>
                </div>
                <h3 className="mt-6 font-heading text-2xl font-bold text-slate-900 dark:text-white">
                  Inquiry Submitted
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Thank you for reaching out. Our team will review your inquiry and
                  get back to you shortly.
                </p>
                <button type="button" onClick={() => {
                setSubmitted(false);
                setName("");
                setEmail("");
                setMessage("");
            }} className="mt-8 rounded-md border border-slate-200 bg-white px-6 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:shadow-none dark:hover:bg-white/10 dark:hover:text-white">
                  Submit Another
                </button>
              </div>) : (<form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-8 shadow-sm dark:border-white/8 dark:bg-[#08111f]">
                <div className="mb-8 flex items-center gap-4 border-b border-slate-200 pb-6 dark:border-white/10">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-200/50 bg-amber-50/50 dark:border-[#d97706]/30 dark:bg-[#d97706]/10">
                    <Inbox className="h-5 w-5 text-[#d97706] dark:text-[#f3b35d]"/>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d97706]">
                      Contact Form
                    </div>
                    <div className="mt-1 font-heading text-lg font-bold text-slate-900 dark:text-white">Send an Inquiry</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="inquiry-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Full name
                  </label>
                  <input id="inquiry-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Robin Padilla" required className="h-12 w-full rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-[#d97706] focus:outline-none focus:ring-1 focus:ring-[#d97706] dark:border-white/10 dark:bg-[#0b1422] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#d97706] dark:focus:ring-[#d97706]/50"/>
                </div>

                <div className="space-y-2">
                  <label htmlFor="inquiry-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email address
                  </label>
                  <input id="inquiry-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="h-12 w-full rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-[#d97706] focus:outline-none focus:ring-1 focus:ring-[#d97706] dark:border-white/10 dark:bg-[#0b1422] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#d97706] dark:focus:ring-[#d97706]/50"/>
                </div>

                <div className="space-y-2">
                  <label htmlFor="inquiry-message" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Tell us about your project
                  </label>
                  <textarea id="inquiry-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your space, timeline, and any specific requirements..." rows={5} required className="w-full resize-y rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-[#d97706] focus:outline-none focus:ring-1 focus:ring-[#d97706] dark:border-white/10 dark:bg-[#0b1422] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#d97706] dark:focus:ring-[#d97706]/50"/>
                </div>

                <button type="submit" disabled={isSubmitting} className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#d97706] font-mono text-xs font-bold uppercase tracking-[0.2em] text-white shadow-md transition-all hover:bg-[#b46305] hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60 dark:text-slate-950 dark:shadow-[0_4px_14px_rgba(217,119,6,0.25)] dark:hover:shadow-[0_6px_20px_rgba(217,119,6,0.3)]">
                  {isSubmitting ? "Sending..." : "Send Inquiry"}
                  <Send className="h-4 w-4"/>
                </button>
              </form>)}
          </motion.div>
        </motion.div>
      </div>
    </section>);
}
function Footer() {
    return (<footer className="border-t border-slate-200 bg-slate-50 py-10 dark:border-white/10 dark:bg-[#050b14]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-heading text-xl tracking-tight text-slate-900 dark:text-white">
            ProximaTrax
          </div>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
            A centralized project management workspace built for AEG Fashion —
            interior design and construction.
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          {new Date().getFullYear()} AEG Fashion · ProximaTrax
        </div>
      </div>
    </footer>);
}
export default function Home() {
    return (<div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-[#d97706] selection:text-slate-950 dark:bg-[#08111f] dark:text-white">
      <div className="bg-noise"/>
      <NavBar />
      <main className="pt-20">
        <HeroSection />
        <CapabilitiesSection />
        <AboutSection />
        <InquirySection />
      </main>
      <Footer />
    </div>);
}
