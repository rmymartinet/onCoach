import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaDbUrl?: string;
};

const rawDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

let parsedDatabaseUrl: URL;
try {
  parsedDatabaseUrl = new URL(rawDatabaseUrl);
} catch {
  throw new Error("DATABASE_URL is not a valid URL");
}

if (!parsedDatabaseUrl.hostname) {
  throw new Error("DATABASE_URL must include a database host");
}

if (!["postgres:", "postgresql:"].includes(parsedDatabaseUrl.protocol)) {
  throw new Error("DATABASE_URL must use postgres:// or postgresql://");
}

const neonAdapter = new PrismaNeonHttp(rawDatabaseUrl, {});
const isDev = process.env.NODE_ENV !== "production";

if (!globalForPrisma.prisma || globalForPrisma.prismaDbUrl !== rawDatabaseUrl) {
  globalForPrisma.prisma = new PrismaClient({
    adapter: neonAdapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  globalForPrisma.prismaDbUrl = rawDatabaseUrl;

  if (process.env.NODE_ENV === "development") {
    // Runtime sanity check, without leaking secrets.
    console.info(`[prisma] initialized for host=${parsedDatabaseUrl.hostname}`);
  }

  if (!isDev) {
    delete globalForPrisma.prismaDbUrl;
  }
}

export const prisma = globalForPrisma.prisma;
