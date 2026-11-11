/**
 * Links opened from Messenger, Facebook or Instagram load in the app's own
 * browser, which refuses location without ever asking. Site photos then go
 * out unplaced, so the crew are told to switch to Chrome or Safari.
 */
export function inAppBrowser(userAgent: string): { android: boolean } | null {
    if (!/FBAN|FBAV|FB_IAB|Instagram/i.test(userAgent))
        return null;
    return { android: /Android/i.test(userAgent) };
}

/** An Android link that opens the same page in Chrome, out of the in-app browser. */
export function chromeIntentUrl(href: string): string {
    const u = new URL(href);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;end`;
}
