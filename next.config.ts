import type { NextConfig } from "next";
const nextConfig: NextConfig = {
    async headers() {
        return [{
                source: "/(.*)",
                headers: [
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                ],
            }];
    },
    experimental: {
        // Reuse a visited page for 30 s on tab hops; server actions that revalidate still clear it.
        staleTimes: { dynamic: 30 },
    },
};
export default nextConfig;
