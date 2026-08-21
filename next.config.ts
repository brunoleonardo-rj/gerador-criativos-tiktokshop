import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "exceljs"],
  outputFileTracingIncludes: { "/*": ["./resources/library/**/*"] },
};

export default nextConfig;
