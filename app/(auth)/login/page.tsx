"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Building2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES, sanitizeNextPath } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { login } from "@/services/auth-service";
export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                supabase.auth.signOut().catch(() => { });
            }
        });
    }, []);
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            const result = await login({ email, password });
            const params = new URLSearchParams(window.location.search);
            const nextParam = sanitizeNextPath(params.get("next"));
            router.replace(nextParam ?? result.redirectTo);
            router.refresh();
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Unable to sign in.");
            setIsSubmitting(false);
        }
    }
    return (<section className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 dark:border-white/8 dark:bg-[#0b1422] dark:shadow-[0_28px_80px_rgba(0,0,0,0.35)]" aria-labelledby="login-heading">
      <div className="relative">
        <div className="mb-8 flex items-center gap-4 border-b border-slate-200 pb-6 dark:border-white/10">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-200/50 bg-amber-50/50 dark:border-[#d97706]/40 dark:bg-[#d97706]/12">
            <Building2 className="h-6 w-6 text-[#d97706] dark:text-[#f3b35d]"/>
          </div>
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d97706]">
              ProximaTrax · Workspace
            </p>
            <h1 id="login-heading" className="mt-1 font-heading text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Sign in to workspace
            </h1>
          </div>
        </div>

        <p className="mb-6 text-sm text-slate-600 dark:text-slate-300/80">
          Sign in with your assigned account credentials.
        </p>

        <form className="space-y-6" onSubmit={handleSubmit} autoComplete="on">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Email address
            </Label>
            <Input id="email" name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="pm@aegfashion.com" required aria-invalid={error ? true : undefined} aria-describedby={error ? "login-error" : undefined} className="h-12 w-full rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-[#d97706] focus:outline-none focus:ring-1 focus:ring-[#d97706] dark:border-white/10 dark:bg-[#08111f] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#d97706] dark:focus:ring-[#d97706]/50"/>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </Label>
              <Link href={ROUTES.FORGOT_PASSWORD} prefetch={false} className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d97706] hover:text-[#b46305] dark:text-[#d97706] dark:hover:text-[#f3b35d]">
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <Input id="password" name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" spellCheck={false} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required aria-invalid={error ? true : undefined} aria-describedby={error ? "login-error" : undefined} className="h-12 w-full rounded-md border border-slate-200 bg-white py-2 pr-12 pl-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-[#d97706] focus:outline-none focus:ring-1 focus:ring-[#d97706] dark:border-white/10 dark:bg-[#08111f] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#d97706] dark:focus:ring-[#d97706]/50"/>
              <Button type="button" variant="ghost" size="icon" className="absolute top-1/2 right-1.5 size-10 -translate-y-1/2 rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-[#d97706]/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-[#d97706]/50" onClick={() => setPasswordVisible((visible) => !visible)} aria-pressed={passwordVisible} aria-label={passwordVisible ? "Hide password" : "Show password"} aria-controls="password">
                {passwordVisible ? (<EyeOff className="size-4.5" strokeWidth={2} aria-hidden/>) : (<Eye className="size-4.5" strokeWidth={2} aria-hidden/>)}
              </Button>
            </div>
          </div>

          {error ? (<div id="login-error" className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-500/20 dark:bg-[#08111f] dark:text-red-400" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>
              <span className="leading-relaxed">{error}</span>
            </div>) : null}

          <Button type="submit" disabled={isSubmitting} className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#d97706] font-mono text-xs font-bold uppercase tracking-[0.2em] text-white shadow-md transition-all hover:bg-[#b46305] hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60 dark:text-slate-950 dark:shadow-[0_4px_14px_rgba(217,119,6,0.25)] dark:hover:shadow-[0_6px_20px_rgba(217,119,6,0.3)]">
            {isSubmitting ? "Signing in..." : "Sign In"}
            <ArrowRight className="h-4 w-4"/>
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link href={ROUTES.HOME} prefetch={false} className="font-medium text-[#d97706] transition-colors hover:text-[#b46305] dark:text-[#f3b35d] dark:hover:text-white">
            Back to homepage
          </Link>
        </p>
      </div>
    </section>);
}
