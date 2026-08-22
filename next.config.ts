import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "exceljs"],
  outputFileTracingIncludes: {
    "/*": [
      "./resources/library/**/*",
      "./node_modules/.pnpm/@next+env@*/node_modules/@next/env/**/*",
      "./node_modules/@swc/helpers/**/*",
    ],
  },
};

export default nextConfig;
