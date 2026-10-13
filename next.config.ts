import type { NextConfig } from "next";
const nextConfig: NextConfig = {
    experimental: {
        // Reuse a visited page for 30 s on tab hops; server actions that revalidate still clear it.
        staleTimes: { dynamic: 30 },
    },
};
export default nextConfig;
