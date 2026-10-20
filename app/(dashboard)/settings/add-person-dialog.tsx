"use client";
import { FormEvent, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { focusRing, primaryAction } from "@/components/dashboard/overview-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLASSIFICATION_TERMS, ROLE_TERMS, personTitle } from "@/lib/vocabulary";
import { cn } from "@/lib/utils";
import { createUser } from "@/services/auth-service";
import type { CrewClassification, UserRole } from "@/types/enums";

const ROLES: Array<{ value: UserRole; can: string }> = [
    { value: "project_manager", can: "Runs projects and accepts work" },
    { value: "middleman", can: "Does the work on site and uploads photos" },
    { value: "client", can: "Follows approved progress and messages the PM" },
];
const CLASSIFICATIONS = Object.keys(CLASSIFICATION_TERMS) as CrewClassification[];
const field = "h-10 rounded-[10px] px-3";

/** 12 characters without look-alikes (0/O, 1/l/I), so it can be read out over the phone. */
function generatePassword() {
    const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from(crypto.getRandomValues(new Uint32Array(12)), (n) => alphabet[n % alphabet.length]).join("");
}

export function AddPersonDialog({ onCreated }: { onCreated: (id: string | undefined) => void }) {
    const [open, setOpen] = useState(false);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [role, setRole] = useState<UserRole>("client");
    const [classification, setClassification] = useState<CrewClassification | null>(null);
    const [contactNumber, setContactNumber] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    function reset() {
        setFullName("");
        setEmail("");
        setPassword("");
        setShowPassword(false);
        setRole("client");
        setClassification(null);
        setContactNumber("");
        setError(null);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        if (role === "middleman" && !classification) {
            setError("Choose what they’re called on site: Site Manager, Foreman or Safety Officer.");
            return;
        }
        setIsSubmitting(true);
        try {
            const id = await createUser({ fullName, email, password, role, classification: role === "middleman" ? classification! : undefined, contactNumber: contactNumber || undefined });
            const details = `ProximaTrax sign-in\nEmail: ${email.trim().toLowerCase()}\nTemporary password: ${password}`;
            toast.success(`${fullName.trim()} can sign in now`, {
                description: `${personTitle({ role, classification })} · ${email.trim().toLowerCase()}`,
                duration: 12000,
                action: {
                    label: "Copy sign-in details",
                    onClick: () => void navigator.clipboard.writeText(details).then(() => toast.success("Sign-in details copied")),
                },
            });
            setOpen(false);
            reset();
            onCreated(id);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Unable to create the account.");
        }
        finally {
            setIsSubmitting(false);
        }
    }

    return (<>
      <button type="button" onClick={() => setOpen(true)} className={primaryAction}>
        <Plus aria-hidden/>
        Add person
      </button>

      <Dialog open={open} onOpenChange={(next) => {
            if (isSubmitting)
                return;
            setOpen(next);
            if (!next)
                setError(null);
        }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-[20px] p-0 sm:max-w-[34rem]">
          <form onSubmit={handleSubmit}>
            <DialogHeader className="px-6 pt-6 pb-1">
              <DialogTitle className="text-[19px] tracking-[-0.018em]">Add a person</DialogTitle>
              <DialogDescription>
                They sign in with this email and temporary password, then set their own.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 px-6 pt-4 pb-6">
              <fieldset>
                <legend className="text-[13px] font-medium text-ink">Role</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {ROLES.map((r) => {
                    const on = role === r.value;
                    return (<label key={r.value} className={cn("press flex cursor-pointer flex-col rounded-[12px] px-3 py-2.5 transition-[box-shadow,background-color] duration-200 has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2", on ? "bg-brand-soft shadow-[0_0_0_1.5px_var(--brand)]" : "bg-surface-sunken/70 hover:bg-surface-sunken")}>
                        <input type="radio" name="role" value={r.value} checked={on} onChange={() => setRole(r.value)} className="sr-only"/>
                        <span className={cn("text-[13.5px] font-semibold", on ? "text-brand-hover" : "text-ink")}>{ROLE_TERMS[r.value]}</span>
                        <span className="mt-0.5 text-[12px] leading-snug text-ink-tertiary">{r.can}</span>
                      </label>);
                })}
                </div>
                {role === "middleman" ? (<div role="radiogroup" aria-label="Classification" className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[12.5px] text-ink-tertiary">Called on site</span>
                    {CLASSIFICATIONS.map((c) => {
                        const on = classification === c;
                        return (<button key={c} type="button" role="radio" aria-checked={on} onClick={() => setClassification(c)} className={cn("press inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium transition-colors", focusRing, on ? "bg-ink text-white" : "bg-surface-sunken/70 text-ink-secondary hover:bg-surface-sunken hover:text-ink")}>
                            {CLASSIFICATION_TERMS[c]}
                          </button>);
                    })}
                  </div>) : null}
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-name">Full name</Label>
                  <Input id="new-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" required className={field}/>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-email">Email</Label>
                  <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required className={field}/>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="new-password">Temporary password</Label>
                  <button type="button" onClick={() => { setPassword(generatePassword()); setShowPassword(true); }} className={cn("inline-flex h-7 items-center gap-1 rounded-full px-2 text-[12.5px] font-medium text-brand hover:bg-brand-soft hover:text-brand-hover", focusRing)}>
                    <RefreshCw className="size-3.5" aria-hidden/>
                    Generate
                  </button>
                </div>
                <div className="relative">
                  <Input id="new-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" aria-describedby="new-password-hint" className={cn(field, "pr-11", showPassword && "font-mono tracking-wide")}/>
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className={cn("absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-tertiary hover:bg-surface-sunken hover:text-ink", focusRing)}>
                    {showPassword ? <EyeOff className="size-4" aria-hidden/> : <Eye className="size-4" aria-hidden/>}
                  </button>
                </div>
                <p id="new-password-hint" className="text-[12px] text-ink-tertiary">At least 8 characters. You can copy it with the email once the account exists.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-contact">
                  Phone <span className="font-normal text-ink-tertiary">(optional)</span>
                </Label>
                <Input id="new-contact" type="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="+63 917 123 4567" autoComplete="off" className={field}/>
              </div>

              {error ? (<p className="flex gap-2.5 rounded-[12px] bg-danger-soft px-3.5 py-3 text-[13px] text-danger" role="alert">
                  <AlertCircle className="mt-px size-4 shrink-0" aria-hidden/>
                  {error}
                </p>) : null}
            </div>

            <DialogFooter className="mx-0 mb-0 rounded-b-[20px] px-6 py-4">
              <Button type="button" variant="ghost" disabled={isSubmitting} onClick={() => setOpen(false)} className="rounded-full">
                Cancel
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting} className="rounded-full px-5">
                {isSubmitting ? <><Loader2 className="animate-spin" aria-hidden/>Adding…</> : "Add person"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>);
}
