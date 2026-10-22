/**
 * What the public inquiry form may send. The route writes with the service
 * role, so this is the only gate: strings only, trimmed, bounded, and an
 * address that looks like one. Pure, so `node --test` runs it.
 */

export const INQUIRY_LIMITS = { name: 120, email: 254, message: 5000 } as const;

export type InquiryInput = { name: string; email: string; message: string };

export function parseInquiry(body: unknown): { ok: true; value: InquiryInput } | { ok: false; error: string } {
    const b = (body ?? {}) as Record<string, unknown>;
    const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const name = text(b.name), email = text(b.email).toLowerCase(), message = text(b.message);
    if (!name || !email || !message)
        return { ok: false, error: "Name, email, and message are required." };
    if (name.length > INQUIRY_LIMITS.name || email.length > INQUIRY_LIMITS.email || message.length > INQUIRY_LIMITS.message)
        return { ok: false, error: `Keep the name under ${INQUIRY_LIMITS.name} characters and the message under ${INQUIRY_LIMITS.message}.` };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return { ok: false, error: "Enter a valid email address." };
    return { ok: true, value: { name, email, message } };
}
