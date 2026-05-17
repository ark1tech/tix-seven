import type { NextConfig } from "next";
import path from "path";

/** Monorepo root (`…/tix-seven`). Needed so Turbopack can resolve `next` under pnpm workspaces (see vercel/next.js#92540). */
const monorepoRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
    outputFileTracingRoot: monorepoRoot,
    turbopack: {
        root: monorepoRoot,
    },
};

export default nextConfig;