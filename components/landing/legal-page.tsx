import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/landing/footer";
import { LegalIndex } from "@/components/landing/legal-index";
import { BrandMark } from "@/components/shell/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { COMPANY_NAME } from "@/lib/vocabulary";

const ring = "outline-none focus-visible:ring-2 focus-visible:ring-land-accent focus-visible:ring-offset-2 focus-visible:ring-offset-land";

/** A paragraph, a bulleted list, or labelled cards (one per record type, each a list of label and value). */
export type LegalBlock = string | { list: string[] } | { cards: { title: string; rows: [string, string][] }[] };
export type LegalSection = { id: string; title: string; body: LegalBlock[] };

function Block({ block }: { block: LegalBlock }) {
    if (typeof block === "string")
        return <p className="mt-4 text-[15px] leading-relaxed text-land-ink-2">{block}</p>;
    if ("list" in block)
        return (<ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-land-ink-2 marker:text-land-ink-3">
          {block.list.map((item) => <li key={item}>{item}</li>)}
        </ul>);
    return (<div className="mt-6 grid gap-4">
      {block.cards.map((card) => (<div key={card.title} className="rounded-2xl border border-land-line p-5">
          <h3 className="text-[15px] font-semibold text-land-ink">{card.title}</h3>
          <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[8.5rem_minmax(0,1fr)]">
            {card.rows.map(([label, value]) => (<div key={label} className="contents">
                <dt className="text-land-ink-3">{label}</dt>
                <dd className="leading-relaxed text-land-ink-2 max-sm:mb-1">{value}</dd>
              </div>))}
          </dl>
        </div>))}
    </div>);
}

/** The public legal pages (terms, data retention): numbered sections with an on-page index. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro?: string; sections: LegalSection[] }) {
    return (<div className="landing min-h-screen bg-land text-land-ink">
      {/* The landing page's top bar in its lifted state: the same floating layer, so moving between pages feels like one site.
          It stays with the reader; text passing under it dissolves into the top edge instead of being sliced off. */}
      <header className="sticky top-0 z-50 px-3 pt-2.5 sm:px-4 sm:pt-3">
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-24 bg-linear-to-b from-land via-land/85 to-transparent backdrop-blur-[6px] mask-[linear-gradient(to_bottom,black_55%,transparent)]"/>
        <nav aria-label="Main" className="mx-auto flex h-14 max-w-[1208px] items-center justify-between gap-2 rounded-[22px] border border-land-line bg-land-raised/90 px-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_1px_2px_rgb(14_18_34/0.08),0_24px_56px_-24px_rgb(14_18_34/0.4)] backdrop-blur-2xl backdrop-saturate-[1.8] sm:h-16 sm:px-3 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_1px_2px_rgb(0_0_0/0.4),0_24px_56px_-20px_rgb(0_0_0/0.7)]">
          <Link href={ROUTES.HOME} className={cn("flex min-w-0 items-center gap-2.5 rounded-xl py-1 pr-1.5 pl-1", ring)}>
            <BrandMark className="size-8 shrink-0 sm:size-9"/>
            <span className="truncate text-[17px] font-semibold tracking-[-0.02em] sm:text-lg">{COMPANY_NAME}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <Link href={ROUTES.LOGIN} prefetch={false} className={cn("press inline-flex h-11 items-center rounded-full px-4 text-[15px] font-medium text-land-ink hover:bg-land-ink/6 sm:px-5", ring)}>Log in</Link>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 pt-10 pb-24 sm:px-6 sm:pt-16 sm:pb-32">
        <Link href={ROUTES.HOME} className={cn("group/back inline-flex items-center gap-1.5 rounded text-sm font-medium text-land-ink-2 transition-colors hover:text-land-ink", ring)}>
          <ArrowLeft className="size-4 transition-transform duration-300 ease-spring group-hover/back:-translate-x-0.5" aria-hidden/>
          Back to home
        </Link>
        <h1 className="mt-8 text-[clamp(2.25rem,4.6vw,3.5rem)] leading-[1.05] font-semibold tracking-[-0.035em]">{title}</h1>
        <p className="mt-4 text-sm text-land-ink-3">Last updated {updated}</p>
        {intro ? <p className="mt-6 max-w-2xl text-base leading-relaxed text-land-ink-2">{intro}</p> : null}

        <div className="mt-10 grid gap-8 sm:mt-14 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16">
          <LegalIndex sections={sections.map(({ id, title }) => ({ id, title }))}/>
          <div className="max-w-2xl">
            {sections.map((s, i) => (<section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-28 border-t max-lg:scroll-mt-40 border-land-line py-10 first:border-t-0 first:pt-0">
                <h2 id={`${s.id}-title`} className="flex items-baseline gap-3 text-xl font-semibold tracking-[-0.02em]">
                  <span className="text-sm font-medium text-brand tabular">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                {s.body.map((b, j) => <Block key={j} block={b}/>)}
              </section>))}
          </div>
        </div>
      </main>

      <Footer />
    </div>);
}
