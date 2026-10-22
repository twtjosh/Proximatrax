import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/shell/brand-mark";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { COMPANY_NAME } from "@/lib/vocabulary";

const ring = "outline-none focus-visible:ring-2 focus-visible:ring-land-accent focus-visible:ring-offset-2 focus-visible:ring-offset-land";

/** Section links point at the home page so they also work from the terms page. */
const COLUMNS = [
    { title: "Explore", links: [{ label: "Overview", href: "/#overview" }, { label: "How it runs", href: "/#journey" }, { label: "Start a project", href: "/#inquire" }] },
    { title: "Clients", links: [{ label: "Log in", href: ROUTES.LOGIN }, { label: "Reset your password", href: ROUTES.FORGOT_PASSWORD }] },
    { title: "Legal", links: [{ label: "Terms and conditions", href: ROUTES.TERMS }] },
];

/** Shared by the landing page and the terms page. Sits inside a `.landing` wrapper for its colours. */
export function Footer() {
    return (<footer className="border-t border-land-line">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 py-16 sm:py-20 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] md:gap-x-10">
          <div className="col-span-2 max-w-sm md:col-span-1">
            <Link href="/" className={cn("inline-flex items-center gap-2.5 rounded-xl py-1 pr-1.5", ring)}>
              <BrandMark className="size-8"/>
              <span className="text-[17px] font-semibold tracking-[-0.02em] text-land-ink">{COMPANY_NAME}</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-land-ink-2">
              Interior design and fit-out, from site survey to handover. Clients follow approved progress on ProximaTrax.
            </p>
            <Link href="/#inquire" className={cn("group/cta mt-6 inline-flex items-center gap-1.5 rounded text-sm font-medium text-land-accent", ring)}>
              Start an inquiry
              <ArrowRight className="size-4 transition-transform duration-300 ease-spring group-hover/cta:translate-x-0.5" aria-hidden/>
            </Link>
          </div>
          {COLUMNS.map((col) => (<nav key={col.title} aria-label={col.title}>
              <h2 className="text-sm font-medium text-land-ink">{col.title}</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {col.links.map((l) => (<li key={l.href}>
                    {l.href.startsWith("/#")
                        ? <a href={l.href} className={cn("rounded text-land-ink-2 transition-colors duration-300 hover:text-land-ink", ring)}>{l.label}</a>
                        : <Link href={l.href} prefetch={false} className={cn("rounded text-land-ink-2 transition-colors duration-300 hover:text-land-ink", ring)}>{l.label}</Link>}
                  </li>))}
              </ul>
            </nav>))}
        </div>
        <div className="flex flex-col gap-2 border-t border-land-line py-6 text-sm text-land-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="tabular">© {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.</p>
          <p>Project tracking by <span className="font-medium text-land-ink-2">ProximaTrax</span></p>
        </div>
      </div>
    </footer>);
}
