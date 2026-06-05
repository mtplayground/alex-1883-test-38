import { PrismaClient } from "@prisma/client";
import { serverConfig } from "../config.js";

type PrismaGlobal = typeof globalThis & {
  prisma?: PrismaClient;
};

const prismaGlobal = globalThis as PrismaGlobal;

export const prisma =
  prismaGlobal.prisma ??
  new PrismaClient({
    log: serverConfig.nodeEnv === "development" ? ["warn", "error"] : ["error"]
  });

if (serverConfig.nodeEnv !== "production") {
  prismaGlobal.prisma = prisma;
}

export const connectDatabase = async () => {
  await prisma.$connect();
};

export const disconnectDatabase = async () => {
  await prisma.$disconnect();
};
