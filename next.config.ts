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
        // Testing on phones through a VS Code tunnel only: the tunnel rewrites Origin to localhost,
        // which Next's server-action check rejects. Never set on Vercel, so production keeps the strict check.
        ...(process.env.TUNNEL_ACTION_ORIGINS ? { serverActions: { allowedOrigins: process.env.TUNNEL_ACTION_ORIGINS.split(",") } } : {}),
    },
};
export default nextConfig;
