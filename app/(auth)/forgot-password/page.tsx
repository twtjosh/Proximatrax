"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { AlertCircle, ArrowLeft, Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendPasswordReset } from "@/services/auth-service";
export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setMessage(null);
        setError(null);
        setIsSubmitting(true);
        try {
            await sendPasswordReset(email);
            setMessage("Password reset instructions were sent to your email.");
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Unable to send reset email.");
        }
        finally {
            setIsSubmitting(false);
        }
    }
    return (<section className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-white/8 dark:bg-[#0b1422] dark:shadow-[0_28px_80px_rgba(0,0,0,0.35)]">
      <div className="relative">
        <div className="mb-8 flex items-center gap-4 border-b border-slate-200 pb-6 dark:border-white/10">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-200/50 bg-amber-50/50 dark:border-[#d97706]/40 dark:bg-[#d97706]/12">
            <Building2 className="h-6 w-6 text-[#d97706] dark:text-[#f3b35d]"/>
          </div>
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d97706]">
              Account Recovery
            </p>
            <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Reset your password
            </h1>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Email address
            </Label>
            <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="pm@aegfashion.com" required className="h-12 w-full rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-[#d97706] focus:outline-none focus:ring-1 focus:ring-[#d97706] dark:border-white/10 dark:bg-[#08111f] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#d97706] dark:focus:ring-[#d97706]/50"/>
          </div>

          {message ? (<div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm dark:border-emerald-500/20 dark:bg-[#08111f] dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>
              <span className="leading-relaxed">{message}</span>
            </div>) : null}

          {error ? (<div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-500/20 dark:bg-[#08111f] dark:text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>
              <span className="leading-relaxed">{error}</span>
            </div>) : null}

          <Button type="submit" disabled={isSubmitting} className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#d97706] font-mono text-xs font-bold uppercase tracking-[0.2em] text-white shadow-md transition-all hover:bg-[#b46305] hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60 dark:text-slate-950 dark:shadow-[0_4px_14px_rgba(217,119,6,0.25)] dark:hover:shadow-[0_6px_20px_rgba(217,119,6,0.3)]">
            {isSubmitting ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>

        <div className="mt-8 flex justify-center">
          <Link href="/login" prefetch={false} className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d97706] transition-colors hover:text-[#b46305] dark:text-[#f3b35d] dark:hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5"/>
            Back to login
          </Link>
        </div>
      </div>
    </section>);
}
