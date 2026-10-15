import "dotenv/config";
import app from "./app";
import { prisma } from "./db";

const port = Number(process.env.PORT ?? 4000);
const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";

async function start(): Promise<void> {
  await prisma.$connect();
  await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
  ]);

  app.listen(port, host, () => {
    console.log(`AZZA auth API listening on http://${host}:${port}`);
  });
}

start().catch((error: unknown) => {
  console.error("Failed to start AZZA auth API:", error);
  process.exitCode = 1;
});
