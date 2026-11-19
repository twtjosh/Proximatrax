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

export type AiPart = { text: string } | { inline_data: { mime_type: string; data: string } } | { file_data: { mime_type: string; file_uri: string } };

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const API = "https://generativelanguage.googleapis.com";
/** Gemini takes at most 20 MB inline per request (base64 adds a third); bigger files go through its Files API. */
export const INLINE_MAX_BYTES = 14 * 1024 * 1024;

/**
 * A document as a part of the request: inline when small, otherwise uploaded
 * to Gemini's Files API. `done` deletes the uploaded copy (Gemini would keep
 * it 48 hours); call it once the answer is in.
 */
export async function filePart(bytes: Buffer, mime: string, key = process.env.GEMINI_API_KEY ?? ""): Promise<{ part: AiPart; done: () => Promise<void> }> {
    if (bytes.length <= INLINE_MAX_BYTES)
        return { part: { inline_data: { mime_type: mime, data: bytes.toString("base64") } }, done: async () => { } };
    try {
        const start = await fetch(`${API}/upload/v1beta/files`, {
            method: "POST",
            headers: { "x-goog-api-key": key, "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": String(bytes.length), "X-Goog-Upload-Header-Content-Type": mime, "Content-Type": "application/json" },
            body: JSON.stringify({ file: { display_name: "project-report" } }),
        });
        const url = start.headers.get("x-goog-upload-url");
        if (!start.ok || !url)
            throw new Error(`Gemini refused the upload (${start.status})`);
        const sent = await fetch(url, { method: "POST", headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" }, body: new Uint8Array(bytes) });
        let file = ((await sent.json()) as { file?: { name: string; uri: string; state?: string } }).file;
        if (!sent.ok || !file)
            throw new Error(`Gemini refused the upload (${sent.status})`);
        // PDFs and photos are usually ready at once; wait briefly if not.
        for (let i = 0; i < 10 && file.state === "PROCESSING"; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            file = (await (await fetch(`${API}/v1beta/${file.name}`, { headers: { "x-goog-api-key": key } })).json()) as typeof file;
        }
        const name = file.name;
        return { part: { file_data: { mime_type: mime, file_uri: file.uri } }, done: async () => void (await fetch(`${API}/v1beta/${name}`, { method: "DELETE", headers: { "x-goog-api-key": key } }).catch(() => { })) };
    }
    catch (e) {
        if (e instanceof TypeError) // fetch failed: network or Gemini down.
            throw new AiBusyError();
        throw e;
    }
}

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
