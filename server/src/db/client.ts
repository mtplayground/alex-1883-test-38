import { PrismaClient } from "@prisma/client";
import { serverConfig } from "../config.js";

type PrismaGlobal = typeof globalThis & {
  prisma?: PrismaClient;
};

const prismaGlobal = globalThis as PrismaGlobal;

export const prisma =
  prismaGlobal.prisma ??
  new PrismaClient({
    log: serverConfig.nodeEnv === "development" ? ["warn", "error"] : []
  });

if (serverConfig.nodeEnv !== "production") {
  prismaGlobal.prisma = prisma;
}

let databaseKeepAlive: NodeJS.Timeout | undefined;

const startDatabaseKeepAlive = () => {
  if (databaseKeepAlive || serverConfig.nodeEnv !== "production") {
    return;
  }

  databaseKeepAlive = setInterval(() => {
    void prisma.$queryRaw`SELECT 1`.catch(() => {
      // The next real request will surface persistent database failures.
    });
  }, 30_000);
  databaseKeepAlive.unref();
};

const stopDatabaseKeepAlive = () => {
  if (!databaseKeepAlive) {
    return;
  }

  clearInterval(databaseKeepAlive);
  databaseKeepAlive = undefined;
};

export const connectDatabase = async () => {
  await prisma.$connect();
  startDatabaseKeepAlive();
};

export const disconnectDatabase = async () => {
  stopDatabaseKeepAlive();
  await prisma.$disconnect();
};
