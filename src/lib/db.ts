import "server-only";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "./env";

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const env = getServerEnv();
  const url = env.DATABASE_URL ?? `file:${env.DATA_DIR.replaceAll("\\", "/")}/app.db`;
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
