import path from "node:path";
import { defineConfig } from "prisma/config";

const dataDir = process.env.DATA_DIR ?? "./data";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL ?? `file:${path.resolve(dataDir, "app.db").replaceAll("\\", "/")}`,
  },
});
