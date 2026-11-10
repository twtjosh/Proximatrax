// What a signed-out visitor can do, against the local isolated build.
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const VIEWPORTS = [320, 375, 390, 430, 768, 1366, 1920];
const PAGES = ["/", "/login", "/forgot-password", "/terms", "/data-retention"];
const PROTECTED = ["/dashboard", "/projects", "/projects/new", "/projects/abc", "/projects/abc/board", "/analytics", "/activity", "/files", "/account", "/messages", "/middleman", "/inquiries", "/settings", "/update-password"];

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const form = (page) => page.locator("section#inquire form");
/** Opens a page and waits for React to attach, so a click isn't a click on inert HTML. */
const open = async (page, path) => {
    const res = await page.goto(path);
    await page.waitForLoadState("networkidle");
    return res;
};

test.beforeEach(async ({ page }) => {
    // Nothing in this suite may reach a hosted Supabase project.
    await page.route(/supabase\.co/, (route) => {
        throw new Error(`Refused request to ${route.request().url()}`);
    });
});

test("ST-01.01 | visitor | Home page loads with a title and no server error | 200 and a main heading", async ({ page }) => {
    const res = await open(page, "/");
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle(/ProximaTrax/i);
    await expect(page.locator("h1").first()).toBeVisible();
});
test("ST-01.02 | visitor | Section links jump to sections that exist | Every in-page nav target resolves", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await open(page, "/");
    const targets = await page.locator('nav[aria-label="Main"] a[href^="#"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(targets.length).toBeGreaterThan(1);
    for (const hash of targets)
        await expect(page.locator(hash), hash).toHaveCount(1);
});
test("ST-01.03 | visitor | Sign-in link opens the login page | /login with email and password labelled", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await open(page, "/");
    await page.locator('nav[aria-label="Main"] a[href="/login"]').first().click();
    await page.waitForURL("**/login");
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});
test("ST-01.04 | visitor | Forgot-password link is reachable from login | /forgot-password", async ({ page }) => {
    await open(page, "/login");
    await page.getByRole("link", { name: /forgot/i }).click();
    await page.waitForURL("**/forgot-password");
});
for (const path of ["/terms", "/data-retention"])
    test(`ST-01.0${path === "/terms" ? 5 : 6} | visitor | Legal page is public | ${path} returns 200 with a heading`, async ({ page }) => {
        expect((await page.goto(path)).status()).toBe(200);
        await expect(page.locator("h1").first()).toBeVisible();
    });
test("ST-01.07 | visitor | An empty inquiry can't be sent | Browser validation stops it, no POST", async ({ page }) => {
    await open(page, "/");
    const posts = [];
    page.on("request", (r) => r.method() === "POST" && r.url().includes("/api/inquiries") && posts.push(r));
    await form(page).locator('button[type="submit"]').click();
    expect(await page.locator("#inquiry-name").evaluate((el) => el.validity.valueMissing)).toBe(true);
    expect(posts.length).toBe(0);
});
test("ST-01.08 | visitor | An invalid email can't be sent | Browser validation stops it, no POST", async ({ page }) => {
    await open(page, "/");
    const posts = [];
    page.on("request", (r) => r.method() === "POST" && r.url().includes("/api/inquiries") && posts.push(r));
    await page.locator("#inquiry-name").fill("Test");
    await page.locator("#inquiry-email").fill("not-an-email");
    await page.locator("#inquiry-message").fill("Hello");
    await form(page).locator('button[type="submit"]').click();
    expect(await page.locator("#inquiry-email").evaluate((el) => el.validity.typeMismatch)).toBe(true);
    expect(posts.length).toBe(0);
});
test("ST-01.09 | visitor | A successful submission confirms to the visitor | API mocked 201, confirmation shown", async ({ page }) => {
    await page.route("**/api/inquiries", (r) => r.fulfill({ status: 201, contentType: "application/json", body: '{"success":true,"id":"x"}' }));
    await open(page, "/");
    await page.locator("#inquiry-name").fill("Test Visitor");
    await page.locator("#inquiry-email").fill("visitor@test.invalid");
    await page.locator("#inquiry-message").fill("Synthetic test message");
    await form(page).locator('button[type="submit"]').click();
    await expect(page.getByText("visitor@test.invalid").first()).toBeVisible();
});
test("ST-01.10 | visitor | A storage failure tells the visitor and keeps what they typed | Isolated backend down: error shown, message retained", async ({ page }) => {
    await open(page, "/");
    await page.locator("#inquiry-name").fill("Test Visitor");
    await page.locator("#inquiry-email").fill(`u${Date.now()}@test.invalid`);
    await page.locator("#inquiry-message").fill("Synthetic test message");
    await form(page).locator('button[type="submit"]').click();
    await expect(page.getByText(/Unable to submit inquiry|could not reach|did not go through/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#inquiry-message")).toHaveValue("Synthetic test message");
});

let n = 0;
for (const path of PROTECTED)
    test(`ST-02.${String(++n).padStart(2, "0")} | anonymous | Direct URL to a private page | ${path} redirects to sign-in`, async ({ page }) => {
        await page.goto(path);
        await page.waitForURL("**/login**");
        expect(new URL(page.url()).searchParams.get("next")).toBe(path);
    });
for (const [method, path] of [["POST", "/api/admin/users"], ["DELETE", "/api/admin/users/11111111-1111-4111-8111-111111111111"], ["PATCH", "/api/admin/users/11111111-1111-4111-8111-111111111111"], ["POST", "/api/projects/with-invitations"]])
    test(`ST-02.${String(++n).padStart(2, "0")} | anonymous | Private API without a session | ${method} ${path} returns 401`, async ({ request }) => {
        const res = await request.fetch(path, { method, data: {} });
        expect(res.status()).toBe(401);
    });
for (const [what, body] of [["malformed JSON", "{oops"], ["missing fields", { name: "A" }], ["bad email", { name: "A", email: "x", message: "y" }]])
    test(`ST-02.${String(++n).padStart(2, "0")} | anonymous | Public API refuses bad input | POST /api/inquiries with ${what} returns 400`, async ({ request }) => {
        const res = await request.post("/api/inquiries", typeof body === "string" ? { data: body, headers: { "content-type": "application/json" } } : { data: body });
        expect(res.status()).toBe(400);
    });
test(`ST-02.${String(++n).padStart(2, "0")} | anonymous | Sign-in failure is shown to the person | Backend unreachable: alert visible, stays on /login`, async ({ page }) => {
    await open(page, "/login");
    await page.getByLabel("Email address").fill("nobody@test.invalid");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /./ }).first()).toBeVisible({ timeout: 20_000 });
    expect(new URL(page.url()).pathname).toBe("/login");
});
test(`ST-02.${String(++n).padStart(2, "0")} | anonymous | Password visibility toggle | Field switches to text and back`, async ({ page }) => {
    await open(page, "/login");
    const field = page.locator("#password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(field).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(field).toHaveAttribute("type", "password");
});

n = 0;
for (const width of VIEWPORTS)
    for (const path of PAGES)
        test(`ST-13.${String(++n).padStart(2, "0")} | visitor | No sideways page scroll | ${path} at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
            await page.goto(path);
            await page.waitForLoadState("load");
            expect(await overflow(page)).toBeLessThanOrEqual(0);
        });
for (const width of [320, 390])
    test(`ST-13.${String(++n).padStart(2, "0")} | visitor | The phone menu opens and offers navigation | Landing menu at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await open(page, "/");
        await page.locator('button[aria-controls="landing-menu"]').click();
        await expect(page.locator("#landing-menu")).toBeVisible();
        await expect(page.locator('#landing-menu a[href="/login"]')).toBeVisible();
    });
test(`ST-13.${String(++n).padStart(2, "0")} | visitor | Inquiry fields fit a phone | Name, email, message inside a 320px viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await open(page, "/");
    await page.locator("#inquiry-name").scrollIntoViewIfNeeded();
    for (const id of ["#inquiry-name", "#inquiry-email", "#inquiry-message"]) {
        const box = await page.locator(id).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(320);
    }
});

n = 0;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
for (const path of PAGES)
    test(`ST-15.${String(++n).padStart(2, "0")} | visitor | Automated WCAG 2.2 AA scan | ${path} has no violations`, async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto(path);
        await page.waitForLoadState("load");
        // Entrance animations settle first, or contrast is measured mid-fade.
        await page.waitForTimeout(800);
        const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes.length} node(s), e.g. ${v.nodes[0].target}`)).toEqual([]);
    });
for (const [what, url] of [["//evil.test", "/login?next=//evil.test"], ["https://evil.test", "/login?next=https://evil.test"], ["/\\evil.test", "/login?next=/%5Cevil.test"]])
    test(`ST-15.${String(++n).padStart(2, "0")} | anonymous | Auth callback ignores an external next | next=${what} stays on this site`, async ({ request, baseURL }) => {
        const res = await request.get(`/api/auth/callback?next=${encodeURIComponent(url.split("next=")[1])}`, { maxRedirects: 0 });
        expect(res.status()).toBeGreaterThanOrEqual(300);
        // next start names itself localhost whatever host was dialled; only leaving the machine would be a failure.
        expect(["localhost", "127.0.0.1"]).toContain(new URL(res.headers().location, baseURL).hostname);
        expect(new URL(res.headers().location, baseURL).pathname).toBe("/login");
    });
test(`ST-15.${String(++n).padStart(2, "0")} | anonymous | Reflected script in a query string doesn't run | ?next and ?q with a script payload`, async ({ page }) => {
    let fired = false;
    page.on("dialog", (d) => {
        fired = true;
        return d.dismiss();
    });
    await page.goto(`/login?next=${encodeURIComponent("<img src=x onerror=alert(1)>")}&q=${encodeURIComponent("<script>alert(1)</script>")}`);
    await page.waitForLoadState("load");
    expect(fired).toBe(false);
    expect(await page.locator("img[src='x']").count()).toBe(0);
});
test(`ST-15.${String(++n).padStart(2, "0")} | visitor | Keyboard reaches the inquiry form's fields in order | Name, email, message, submit`, async ({ page, browserName }) => {
    await open(page, "/");
    await page.locator("#inquiry-name").scrollIntoViewIfNeeded();
    await page.locator("#inquiry-name").focus();
    const order = [];
    for (let i = 0; i < 3; i++) {
        await page.keyboard.press("Tab");
        order.push(await page.evaluate(() => document.activeElement.id || document.activeElement.getAttribute("type")));
    }
    expect(order, browserName).toEqual(["inquiry-email", "inquiry-message", "submit"]);
});
test(`ST-15.${String(++n).padStart(2, "0")} | visitor | Focus is visible on a text field | The focused field has a visible outline, ring or border change`, async ({ page }) => {
    await open(page, "/");
    const field = page.locator("#inquiry-name");
    await field.scrollIntoViewIfNeeded();
    const style = () => field.evaluate((el) => {
        const s = getComputedStyle(el);
        return `${s.outlineStyle}|${s.outlineWidth}|${s.boxShadow}|${s.borderColor}`;
    });
    const before = await style();
    await field.focus();
    await page.waitForTimeout(300);
    expect(await style()).not.toBe(before);
});
test(`ST-15.${String(++n).padStart(2, "0")} | visitor | Every inquiry field has a label | Name, email, message are labelled`, async ({ page }) => {
    await open(page, "/");
    for (const id of ["inquiry-name", "inquiry-email", "inquiry-message"])
        await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
});
for (const [header, want] of [["x-frame-options", "DENY"], ["x-content-type-options", "nosniff"], ["referrer-policy", "strict-origin-when-cross-origin"]])
    test(`ST-15.${String(++n).padStart(2, "0")} | visitor | Regression D-24: the build sends browser hardening headers | ${header}: ${want}`, async ({ request }) => {
        expect((await request.get("/")).headers()[header]).toBe(want);
    });
for (const reducedMotion of ["reduce", "no-preference"])
    test(`ST-15.${String(++n).padStart(2, "0")} | visitor | Regression D-25: the landing page hydrates cleanly | prefers-reduced-motion ${reducedMotion}, no React error`, async ({ browser }) => {
        const context = await browser.newContext({ reducedMotion, baseURL: test.info().project.use.baseURL });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await open(page, "/");
        await page.waitForTimeout(1000);
        await context.close();
        expect(errors.filter((m) => /Minified React error #4(18|19|2[35])|Hydration/i.test(m))).toEqual([]);
    });
