import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import cors from "cors";
import "dotenv/config";
import express, { type Request, type Response } from "express";

const app = express();

const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = new Set([
  process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const sessionLifetimeSeconds = 60 * 60 * 24 * 7;

const databasePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "azza.sqlite",
);

const database = new Database(databasePath);

// Initialize database schema
database
  .prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
  )
  .run();

database
  .prepare(
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`,
  )
  .run();

// Clean up expired sessions
database
  .prepare("DELETE FROM sessions WHERE expires_at <= ?")
  .run(Math.floor(Date.now() / 1000));

// Detect password column name for migrations from older schemas
const userTableInfo = database.prepare("PRAGMA table_info(users)").all() as any[];
const hasPasswordHash = userTableInfo.some((c) => c.name === "password_hash");
const passwordColumn = hasPasswordHash ? "password_hash" : "password";

// Detect sessions schema differences (older DBs use token_hash + integer id)
const sessionsTableInfo = database.prepare("PRAGMA table_info(sessions)").all() as any[];
const hasTokenHash = sessionsTableInfo.some((c) => c.name === "token_hash");

// Middleware
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

// Session middleware
app.use((req: Request, res: Response, next) => {
  const sessionId = req.headers.cookie
    ?.split("; ")
    .find((c) => c.startsWith("session="))
    ?.slice(8);

  if (sessionId) {
    const session = database
      .prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > ?")
      .get(sessionId, Math.floor(Date.now() / 1000)) as any;

    if (session) {
      (req as any).userId = session.user_id;
      (req as any).sessionId = sessionId;
    }
  }

  next();
});

// Auth Routes

// Helper function to hash password
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Helper function to create session
function createSession(userId: number): string {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = Math.floor(Date.now() / 1000) + sessionLifetimeSeconds;

  if (hasTokenHash) {
    // older schema: sessions has token_hash column and integer id PK
    database
      .prepare(
        "INSERT INTO sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(userId, sessionId, expiresAt, Math.floor(Date.now() / 1000));
  } else {
    database
      .prepare(
        "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(sessionId, userId, expiresAt, Math.floor(Date.now() / 1000));
  }

  return sessionId;
}

// Signup
app.post("/api/auth/signup", (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required" });
    }

    const hashedPassword = hashPassword(password);

    const result = database
      .prepare(
        `INSERT INTO users (name, email, ${passwordColumn}, created_at) VALUES (?, ?, ?, ?)`,
      )
      .run(name, email, hashedPassword, Math.floor(Date.now() / 1000)) as any;

    const sessionId = createSession(result.lastInsertRowid as number);

    res.cookie("session", sessionId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "Lax",
      maxAge: sessionLifetimeSeconds,
    });

    res.json({
      user: {
        id: result.lastInsertRowid,
        name,
        email,
      },
    });
  } catch (error: any) {
    console.error(error);
    if (error.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "Email already exists" });
    }

    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/auth/login", (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const hashedPassword = hashPassword(password);

    const user = database
      .prepare(`SELECT * FROM users WHERE email = ? AND ${passwordColumn} = ?`)
      .get(email, hashedPassword) as any;

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const sessionId = createSession(user.id);

    res.cookie("session", sessionId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "Lax",
      maxAge: sessionLifetimeSeconds,
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get current user
app.get("/api/auth/me", (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = database
      .prepare("SELECT id, name, email FROM users WHERE id = ?")
      .get(userId) as any;

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Logout
app.post("/api/auth/logout", (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).sessionId;

    if (sessionId) {
      database.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    }

    res.clearCookie("session");
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

export default app;
