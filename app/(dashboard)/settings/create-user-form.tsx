"use client";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createUser } from "@/services/auth-service";
import type { UserRole } from "@/types/enums";
const roleOptions: Array<{
    value: UserRole;
    label: string;
}> = [
    { value: "project_manager", label: "Project Manager" },
    { value: "middleman", label: "Middleman" },
    { value: "client", label: "Client" },
];
const fieldClass = "h-10 rounded-lg border-zinc-200 bg-white shadow-sm transition-shadow focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400/25";
const selectClass = "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400/25";
export function CreateUserForm() {
    const router = useRouter();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<UserRole>("client");
    const [contactNumber, setContactNumber] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSuccess(null);
        setIsSubmitting(true);
        try {
            await createUser({
                fullName,
                email,
                password,
                role,
                contactNumber: contactNumber || undefined,
            });
            setSuccess(`Account created for ${fullName} (${role}).`);
            setFullName("");
            setEmail("");
            setPassword("");
            setRole("client");
            setContactNumber("");
            router.refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Unable to create account.");
        }
        finally {
            setIsSubmitting(false);
        }
    }
    return (<form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-name" className="text-zinc-700">
            Full name
          </Label>
          <Input id="new-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Juan Dela Cruz" required className={fieldClass}/>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-email" className="text-zinc-700">
            Email address
          </Label>
          <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" required className={fieldClass}/>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="new-password" className="text-zinc-700">
            Temporary password
          </Label>
          <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" minLength={8} required className={fieldClass}/>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-role" className="text-zinc-700">
            Role
          </Label>
          <select id="new-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={selectClass}>
            {roleOptions.map((opt) => (<option key={opt.value} value={opt.value}>
                {opt.label}
              </option>))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-contact" className="text-zinc-700">
            Contact number{" "}
            <span className="font-normal text-zinc-400">(optional)</span>
          </Label>
          <Input id="new-contact" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="+63 XXX XXX XXXX" className={fieldClass}/>
        </div>
      </div>

      {error ? (<div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600"/>
          <span>{error}</span>
        </div>) : null}

      {success ? (<div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/>
          <span>{success}</span>
        </div>) : null}

      <Button type="submit" disabled={isSubmitting} className={cn("h-11 rounded-lg border border-rose-700/25 bg-linear-to-r from-rose-600 to-rose-700 px-6 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-md shadow-rose-950/25", "hover:from-rose-500 hover:to-rose-600")}>
        {isSubmitting ? "Creating…" : "Create user"}
        <ArrowRight className="h-4 w-4"/>
      </Button>
    </form>);
}
