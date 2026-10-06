import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const badgeVariants = cva("group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-1.5 text-xs font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring/40 [&>svg]:pointer-events-none [&>svg]:size-3!", {
    variants: {
        variant: {
            default: "bg-primary text-primary-foreground",
            secondary: "bg-surface-sunken text-ink-secondary",
            destructive: "bg-danger-soft text-danger",
            outline: "border-line-strong text-ink-secondary",
            ghost: "text-ink-secondary",
            link: "text-ink underline-offset-4 hover:underline",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});
function Badge({ className, variant = "default", render, ...props }: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
    return useRender({
        defaultTagName: "span",
        props: mergeProps<"span">({
            className: cn(badgeVariants({ variant }), className),
        }, props),
        render,
        state: {
            slot: "badge",
            variant,
        },
    });
}
export { Badge, badgeVariants };
