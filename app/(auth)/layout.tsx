import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};
export default function AuthLayout({ children, }: {
    children: React.ReactNode;
}) {
    return (<div className="relative min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#08111f] selection:bg-[#d97706] selection:text-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="bg-noise"/>
      <div className="bg-grid opacity-5 dark:opacity-20"/>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.08),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.05),transparent_32%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_32%)]"/>
      <div className="relative w-full max-w-md z-10">{children}</div>
    </div>);
}
