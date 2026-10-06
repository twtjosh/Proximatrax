import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva("group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", {
    variants: {
        variant: {
            default: "bg-primary text-primary-foreground hover:bg-primary/88 active:bg-primary/80",
            brand: "bg-brand text-white hover:bg-brand-hover active:bg-brand-hover",
            outline: "border-input bg-surface text-ink hover:bg-surface-subtle hover:border-ink-tertiary/60 aria-expanded:bg-surface-sunken",
            secondary: "bg-surface-sunken text-ink hover:bg-line aria-expanded:bg-line",
            ghost: "text-ink-secondary hover:bg-surface-sunken hover:text-ink aria-expanded:bg-surface-sunken aria-expanded:text-ink",
            destructive: "bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger/30",
            link: "h-auto px-0 text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink",
        },
        size: {
            default: "h-9 gap-2 px-3.5",
            xs: "h-7 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
            sm: "h-8 gap-1.5 px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
            lg: "h-10 gap-2 px-4",
            icon: "size-9",
            "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
            "icon-sm": "size-8",
            "icon-lg": "size-10",
        },
    },
    defaultVariants: {
        variant: "default",
        size: "default",
    },
});
function Button({ className, variant = "default", size = "default", nativeButton: nativeButtonProp, render, ...props }: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
    const nativeButton = nativeButtonProp !== undefined ? nativeButtonProp : render === undefined;
    return (<ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} nativeButton={nativeButton} render={render} {...props}/>);
}
export { Button, buttonVariants };
