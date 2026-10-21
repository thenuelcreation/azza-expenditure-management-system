import crypto from "node:crypto";
import cors from "cors";
import cookieParser from "cookie-parser";
import "dotenv/config";
import express, { type Request, type Response } from "express";
import nodemailer from "nodemailer";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";

const app = express();
app.set("trust proxy", 1);
const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";
const allowedOrigins = new Set([
  process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;
const resetTokenLifetimeMs = 60 * 60 * 1000;

type ExpenditureInput = {
  date: Date;
  category: string;
  subcategory: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  description: string;
};

type ParsedExpenditureInput =
  | { value: ExpenditureInput; error: null }
  | { value: null; error: string };

function parseExpenditureInput(body: unknown):
  ParsedExpenditureInput {
  if (!body || typeof body !== "object") {
    return { value: null, error: "Expenditure details are required." };
  }
  const data = body as Record<string, unknown>;
  const { date, category, subcategory, amount, currency, paymentMethod } = data;
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    typeof category !== "string" ||
    !category.trim() ||
    typeof subcategory !== "string" ||
    !subcategory.trim() ||
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 999999999999.99 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8 ||
    typeof currency !== "string" ||
    !/^[A-Z]{3}$/.test(currency) ||
    typeof paymentMethod !== "string" ||
    !paymentMethod.trim()
  ) {
    return {
      value: null,
      error: "Please provide a valid date, category, amount, currency, and payment method.",
    };
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (parsedDate.toISOString().slice(0, 10) !== date) {
    return { value: null, error: "Please provide a valid expenditure date." };
  }
  if (data.description !== undefined && typeof data.description !== "string") {
    return { value: null, error: "Description must be text." };
  }

  return {
    value: {
      date: parsedDate,
      category: category.trim(),
      subcategory: subcategory.trim(),
      amount,
      currency,
      paymentMethod: paymentMethod.trim(),
      description: typeof data.description === "string" ? data.description.trim() : "",
    },
    error: null,
  };
}

function serializeExpenditure(expenditure: {
  id: number;
  date: Date;
  category: string;
  subcategory: string;
  amount: number | Prisma.Decimal;
  currency: string;
  paymentMethod: string;
  description: string;
}) {
  return {
    ...expenditure,
    date: expenditure.date.toISOString().slice(0, 10),
    amount: Number(expenditure.amount),
  };
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use(async (req: Request, _res: Response, next) => {
  try {
    const sessionToken = req.cookies?.session as string | undefined;
    if (!sessionToken) {
      next();
      return;
    }

    const session = await prisma.session.findFirst({
      where: {
        id: hashToken(sessionToken),
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true },
    });

    if (session) {
      req.userId = session.userId;
      req.sessionId = session.id;
    }

    next();
  } catch (error) {
    next(error);
  }
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return "Password must include uppercase, lowercase, a number, and a symbol";
  }
  return null;
}

function validateSignupInput(
  name: unknown,
  email: unknown,
  password: unknown,
): string | null {
  if (typeof name !== "string" || !name.trim()) {
    return "Name is required";
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))) {
    return "Please provide a valid email address";
  }
  if (typeof password !== "string") {
    return "Password is required";
  }
  return validatePassword(password);
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(`scrypt:${salt.toString("hex")}:${derivedKey.toString("hex")}`);
    });
  });
}

function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = encodedHash.split(":");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) {
    return Promise.resolve(false);
  }

  const salt = Buffer.from(saltHex, "hex");
  const expectedHash = Buffer.from(hashHex, "hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, expectedHash.length, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(
        expectedHash.length === derivedKey.length &&
          crypto.timingSafeEqual(expectedHash, derivedKey),
      );
    });
  });
}

function setSessionCookie(res: Response, sessionToken: string): void {
  res.cookie("session", sessionToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: sessionLifetimeSeconds * 1000,
  });
}

async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + sessionLifetimeSeconds * 1000),
    },
  });
  return token;
}

type PasswordResetEmailResult = "sent" | "not-configured" | "failed";

async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<PasswordResetEmailResult> {
  const resetLink = `${process.env.CLIENT_ORIGIN ?? "http://localhost:5173"}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const configuredPass = process.env.SMTP_PASS;
  const pass =
    host?.toLowerCase() === "smtp.gmail.com"
      ? configuredPass?.replace(/\s/g, "")
      : configuredPass;

  if (!host || !user || !pass) {
    if (!isDevelopment) {
      throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASS must be configured to send reset emails.");
    }
    return "not-configured";
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? user,
      to: email,
      subject: "Reset your AZZA password",
      text: `Use this reset token to change your password: ${token}\n\nOr open: ${resetLink}`,
      html: `<p>Use the reset token below, or <a href="${resetLink}">open this link</a>.</p><p><strong>${token}</strong></p>`,
    });
    return "sent";
  } catch (error) {
    if (!isDevelopment) {
      throw error;
    }
    const smtpError =
      error && typeof error === "object"
        ? (error as { code?: unknown; responseCode?: unknown })
        : {};
    console.error("Password reset email delivery failed in development:", {
      code: typeof smtpError.code === "string" ? smtpError.code : undefined,
      responseCode:
        typeof smtpError.responseCode === "number"
          ? smtpError.responseCode
          : undefined,
    });
    return "failed";
  }
}

app.post("/api/auth/signup", async (req: Request, res: Response) => {
  const { name, email, password } = req.body ?? {};
  const validationError = validateSignupInput(name, email, password);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  try {
    const normalizedName = (name as string).trim();
    const normalizedEmail = normalizeEmail(email as string);
    const user = await prisma.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        password: await hashPassword(password as string),
      },
      select: { id: true, name: true, email: true },
    });
    const sessionToken = await createSession(user.id);
    setSessionCookie(res, sessionToken);
    res.status(201).json({ user });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(400).json({ error: "Email already exists" });
      return;
    }
    console.error("Unable to create account:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
    if (!user || !(await verifyPassword(password, user.password))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const sessionToken = await createSession(user.id);
    setSessionCookie(res, sessionToken);
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Unable to log in:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/request-password-reset", async (req: Request, res: Response) => {
  const { email } = req.body ?? {};
  if (typeof email !== "string" || !email.trim()) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  try {
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
        prisma.passwordResetToken.create({
          data: {
            id: hashToken(token),
            userId: user.id,
            expiresAt: new Date(Date.now() + resetTokenLifetimeMs),
          },
        }),
      ]);
      const emailResult = await sendPasswordResetEmail(normalizedEmail, token);
      if (emailResult !== "sent") {
        if (isDevelopment) {
          res.json({
            message:
              emailResult === "not-configured"
                ? "Password-reset email isn't configured. You can still set a new password here."
                : "The password-reset email couldn't be sent. Check the backend SMTP settings; you can still set a new password here.",
            resetToken: token,
          });
          return;
        }
        throw new Error("Password reset email could not be delivered.");
      }
    }
    res.json({
      message: "If that email is registered, a password reset link will be sent.",
    });
  } catch (error) {
    console.error("Unable to process password reset request:", error);
    res.status(500).json({ error: "Unable to process password reset request" });
  }
});

app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
  const { email, token, password } = req.body ?? {};
  if (
    typeof email !== "string" ||
    typeof token !== "string" ||
    typeof password !== "string" ||
    !email ||
    !token ||
    !password
  ) {
    res.status(400).json({ error: "Email, token, and password are required" });
    return;
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    res.status(400).json({ error: passwordError });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
    if (!user) {
      res.status(400).json({ error: "Invalid reset request" });
      return;
    }

    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        id: hashToken(token),
        userId: user.id,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!resetRecord) {
      res.status(401).json({ error: "Invalid or expired reset token" });
      return;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: await hashPassword(password) },
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    ]);
    res.json({ message: "Password reset successful. Please sign in." });
  } catch (error) {
    console.error("Unable to reset password:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/auth/me", async (req: Request, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true },
    });
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({ user });
  } catch (error) {
    console.error("Unable to get current user:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/logout", async (req: Request, res: Response) => {
  try {
    if (req.sessionId) {
      await prisma.session.deleteMany({ where: { id: req.sessionId } });
    }
    res.clearCookie("session", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    });
    res.status(204).send();
  } catch (error) {
    console.error("Unable to log out:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/expenditures", async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const expenditures = await prisma.expenditure.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        date: true,
        category: true,
        subcategory: true,
        amount: true,
        currency: true,
        paymentMethod: true,
        description: true,
      },
    });
    res.json({ expenditures: expenditures.map(serializeExpenditure) });
  } catch (error) {
    console.error("Unable to load expenditures:", error);
    res.status(500).json({ error: "Unable to load expenditures" });
  }
});

app.post("/api/expenditures", async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = parseExpenditureInput(req.body);
  if (parsed.error || !parsed.value) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    const expenditure = await prisma.expenditure.create({
      data: { ...parsed.value, userId },
      select: {
        id: true,
        date: true,
        category: true,
        subcategory: true,
        amount: true,
        currency: true,
        paymentMethod: true,
        description: true,
      },
    });
    res.status(201).json({ expenditure: serializeExpenditure(expenditure) });
  } catch (error) {
    console.error("Unable to create expenditure:", error);
    res.status(500).json({ error: "Unable to create expenditure" });
  }
});

app.put("/api/expenditures/:id", async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid expenditure ID." });
    return;
  }
  const parsed = parseExpenditureInput(req.body);
  if (parsed.error || !parsed.value) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    const update = await prisma.expenditure.updateMany({
      where: { id, userId },
      data: parsed.value,
    });
    if (update.count === 0) {
      res.status(404).json({ error: "Expenditure not found." });
      return;
    }
    const expenditure = await prisma.expenditure.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        date: true,
        category: true,
        subcategory: true,
        amount: true,
        currency: true,
        paymentMethod: true,
        description: true,
      },
    });
    res.json({ expenditure: serializeExpenditure(expenditure) });
  } catch (error) {
    console.error("Unable to update expenditure:", error);
    res.status(500).json({ error: "Unable to update expenditure" });
  }
});

app.delete("/api/expenditures/:id", async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid expenditure ID." });
    return;
  }
  try {
    const deleted = await prisma.expenditure.deleteMany({ where: { id, userId } });
    if (deleted.count === 0) {
      res.status(404).json({ error: "Expenditure not found." });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error("Unable to delete expenditure:", error);
    res.status(500).json({ error: "Unable to delete expenditure" });
  }
});

app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({ status: "error", error: "Database unavailable" });
  }
});

export default app;