"use client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AlertCircle, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { getCurrentAuthSession } from "@/services/auth-service";
const fieldClass = "h-12 w-full rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-[#d97706] focus:outline-none focus:ring-1 focus:ring-[#d97706] dark:border-white/10 dark:bg-[#08111f] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#d97706] dark:focus:ring-[#d97706]/50";
/** Reached from the reset email via /api/auth/callback, which leaves a recovery session. */
export default function UpdatePasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        if (password !== confirm) {
            setError("The two passwords don't match.");
            return;
        }
        setIsSubmitting(true);
        try {
            const { error } = await createClient().auth.updateUser({ password });
            if (error)
                throw error;
            const session = await getCurrentAuthSession();
            router.replace(session?.redirectTo ?? ROUTES.LOGIN);
            router.refresh();
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Unable to update your password.");
            setIsSubmitting(false);
        }
    }
    return (<section className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-white/8 dark:bg-[#0b1422] dark:shadow-[0_28px_80px_rgba(0,0,0,0.35)]">
      <div className="mb-8 flex items-center gap-4 border-b border-slate-200 pb-6 dark:border-white/10">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-200/50 bg-amber-50/50 dark:border-[#d97706]/40 dark:bg-[#d97706]/12">
          <KeyRound className="h-6 w-6 text-[#d97706] dark:text-[#f3b35d]"/>
        </div>
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d97706]">
            Account Recovery
          </p>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Choose a new password
          </h1>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="new-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            New password
          </Label>
          <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 characters" minLength={8} required className={fieldClass}/>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Confirm new password
          </Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} required aria-invalid={error ? true : undefined} aria-describedby={error ? "update-password-error" : undefined} className={fieldClass}/>
        </div>

        {error ? (<div id="update-password-error" role="alert" className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-500/20 dark:bg-[#08111f] dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>
            <span className="leading-relaxed">{error}</span>
          </div>) : null}

        <Button type="submit" disabled={isSubmitting} className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#d97706] font-mono text-xs font-bold uppercase tracking-[0.2em] text-white shadow-md transition-all hover:bg-[#b46305] hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60 dark:text-slate-950">
          {isSubmitting ? "Saving..." : "Save New Password"}
        </Button>
      </form>
    </section>);
}
