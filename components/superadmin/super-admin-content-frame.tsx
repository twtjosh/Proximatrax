import { cn } from "@/lib/utils";
export function SuperAdminContentFrame({ children, className, }: {
    children: React.ReactNode;
    className?: string;
}) {
    return (<div className={cn("mx-auto w-full max-w-5xl space-y-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500", className)}>
      {children}
    </div>);
}
