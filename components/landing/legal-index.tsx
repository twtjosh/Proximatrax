"use client";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const ring = "outline-none focus-visible:ring-2 focus-visible:ring-land-accent focus-visible:ring-offset-2 focus-visible:ring-offset-land";

/** A section is being read once its top passes 40% down the screen, but never above the floating top bar. */
const readLine = () => Math.max(180, window.innerHeight * 0.4);

/** The last section whose heading has passed under the top bar; the final one once the page bottoms out. */
function useActiveSection(ids: string[]) {
    const [active, setActive] = React.useState(ids[0] ?? "");
    React.useEffect(() => {
        let frame = 0;
        const update = () => {
            frame = 0;
            const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
            const line = readLine();
            let current = ids[0] ?? "";
            for (const id of ids) {
                const el = document.getElementById(id);
                if (el && el.getBoundingClientRect().top <= line)
                    current = id;
            }
            setActive(atBottom ? ids[ids.length - 1] ?? current : current);
        };
        const onScroll = () => {
            if (!frame)
                frame = requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, [ids]);
    return active;
}

const number = (i: number) => String(i + 1).padStart(2, "0");

/**
 * The on-page index: a sticky rail beside the text on wide screens, marking
 * the section being read, and a collapsible list above the text on phones.
 */
export function LegalIndex({ sections }: { sections: { id: string; title: string }[] }) {
    const ids = React.useMemo(() => sections.map((s) => s.id), [sections]);
    const active = useActiveSection(ids);
    const current = sections.findIndex((s) => s.id === active);
    const detailsRef = React.useRef<HTMLDetailsElement>(null);

    return (<>
      <nav aria-label="On this page" className="max-lg:hidden">
        <div className="sticky top-28">
        <p className="mb-4 text-xs font-medium tracking-[0.01em] text-land-ink-3">On this page</p>
        <ol className="space-y-1 border-l border-land-line text-sm">
          {sections.map((s, i) => (<li key={s.id}>
              <a href={`#${s.id}`} aria-current={s.id === active ? "location" : undefined} className={cn("-ml-px flex gap-3 border-l py-1 pl-4 transition-[color,border-color] duration-300 ease-spring", s.id === active ? "border-copper font-medium text-land-ink" : "border-transparent text-land-ink-2 hover:border-land-ink-3 hover:text-land-ink", ring)}>
                <span className={cn("w-5 tabular", s.id === active ? "text-land-accent" : "text-land-ink-3")}>{number(i)}</span>
                {s.title}
              </a>
            </li>))}
        </ol>
        </div>
      </nav>

      {/* On phones the index rides under the top bar, so any section is one tap away mid-read. */}
      <details ref={detailsRef} className="group/index sticky top-[4.75rem] z-40 rounded-2xl border border-land-line bg-land-raised/95 shadow-[0_12px_32px_-20px_rgb(14_18_34/0.45)] backdrop-blur-xl sm:top-[5.5rem] lg:hidden">
        <summary className={cn("flex h-12 cursor-pointer list-none items-center gap-3 rounded-2xl px-4 text-sm [&::-webkit-details-marker]:hidden", ring)}>
          <span className="font-medium text-land-ink">On this page</span>
          <span className="min-w-0 flex-1 truncate text-land-ink-3">{current >= 0 ? `${number(current)} ${sections[current].title}` : null}</span>
          <ChevronDown className="size-4 shrink-0 text-land-ink-3 transition-transform duration-300 ease-spring group-open/index:rotate-180" aria-hidden/>
        </summary>
        <ol className="grid max-h-[60dvh] gap-0.5 overflow-y-auto overscroll-contain border-t border-land-line p-2 text-sm">
          {sections.map((s, i) => (<li key={s.id}>
              <a href={`#${s.id}`} onClick={() => detailsRef.current?.removeAttribute("open")} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-2.5 hover:bg-land-ink/6", s.id === active ? "font-medium text-land-ink" : "text-land-ink-2", ring)}>
                <span className={cn("w-5 tabular", s.id === active ? "text-land-accent" : "text-land-ink-3")}>{number(i)}</span>
                {s.title}
              </a>
            </li>))}
        </ol>
      </details>
    </>);
}
