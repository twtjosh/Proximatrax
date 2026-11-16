/**
 * Server only: reads GEMINI_API_KEY. Import it from route handlers, never
 * from a client component.
 *
 * One call to Gemini that must come back as JSON matching a schema. A rate
 * limit, a timeout, or two outages or unreadable answers in a row become
 * AiBusyError, whose message the PM sees as is.
 */

export const BUSY_MESSAGE = "The AI is busy. Try again in a minute; your report is kept.";
export const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export class AiBusyError extends Error {
    constructor() {
        super(BUSY_MESSAGE);
        this.name = "AiBusyError";
    }
}

export type AiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export async function generateJson(parts: AiPart[], schema: object, opts: { model?: string; key?: string; timeoutMs?: number; retryDelayMs?: number } = {}): Promise<unknown> {
    const key = opts.key ?? process.env.GEMINI_API_KEY;
    if (!key)
        throw new Error("GEMINI_API_KEY is not set on the server.");
    const model = opts.model ?? (process.env.GEMINI_MODEL || DEFAULT_MODEL);
    const body = JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema },
    });
    for (let attempt = 0; attempt < 2; attempt++) {
        let res: Response;
        try {
            res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": key },
                body,
                signal: AbortSignal.timeout(opts.timeoutMs ?? 55_000),
            });
        }
        catch {
            throw new AiBusyError();
        }
        if (res.status === 429)
            throw new AiBusyError();
        // The free tier is sometimes briefly overloaded: one more try after a pause.
        if (res.status >= 500) {
            if (attempt === 0) {
                await new Promise((r) => setTimeout(r, opts.retryDelayMs ?? 2000));
                continue;
            }
            throw new AiBusyError();
        }
        if (!res.ok)
            throw new Error(`Gemini refused the request (${res.status}): ${(await res.text()).slice(0, 300)}`);
        try {
            const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
            const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
            if (text)
                return JSON.parse(text);
        }
        catch {
            // Unreadable answer: try once more.
        }
    }
    throw new AiBusyError();
}
