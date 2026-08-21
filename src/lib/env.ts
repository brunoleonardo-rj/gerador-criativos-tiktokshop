import "server-only";
import path from "node:path";
import { z } from "zod";

const canonicalBase64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(12),
  AUTH_SECRET: z.string().min(32),
  SETTINGS_ENCRYPTION_KEY: z.string().refine(
    (value) => canonicalBase64.test(value) && Buffer.from(value, "base64").length === 32,
    "deve ter 32 bytes em base64",
  ),
  DATA_DIR: z.string().default("./data"),
  DATABASE_URL: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema> & { DATA_DIR: string };

export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = schema.parse(source);
  return { ...parsed, DATA_DIR: path.resolve(parsed.DATA_DIR) };
}
