import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import cors from 'cors'
import 'dotenv/config'
import express, { type Request, type Response } from 'express'

const app = express()
const port = Number(process.env.PORT ?? 4000)
const isProduction = process.env.NODE_ENV === 'production'
const allowedOrigins = new Set([process.env.CLIENT_ORIGIN ?? 'http://localhost:5173', 'http://127.0.0.1:5173'])
const sessionLifetimeSeconds = 60 * 60 * 24 * 7
const databasePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'azza.sqlite')
const database = new Database(databasePath)

database.pragma('journal_mode = WAL')
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)

app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: true }))
app.use(express.json({ limit: '20kb' }))

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const passwordRequirements = [
  { test: (password: string) => password.length >= 12, message: 'Password must be at least 12 characters.' },
  { test: (password: string) => /[a-z]/.test(password), message: 'Password must include a lowercase letter.' },
  { test: (password: string) => /[A-Z]/.test(password), message: 'Password must include an uppercase letter.' },
  { test: (password: string) => /\d/.test(password), message: 'Password must include a number.' },
  { test: (password: string) => /[^A-Za-z0-9]/.test(password), message: 'Password must include a special character.' },
]

function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex')
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }, (error, derivedKey) => {
      if (error) return reject(error)
      resolve(`scrypt:16384:8:1:${salt}:${derivedKey.toString('hex')}`)
    })
  })
}

function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [algorithm, n, r, p, salt, hash] = storedHash.split(':')
    if (algorithm !== 'scrypt' || !n || !r || !p || !salt || !hash) return resolve(false)
    crypto.scrypt(password, salt, 64, { N: Number(n), r: Number(r), p: Number(p), maxmem: 32 * 1024 * 1024 }, (error, derivedKey) => {
      if (error) return reject(error)
      const expected = Buffer.from(hash, 'hex')
      resolve(expected.length === derivedKey.length && crypto.timingSafeEqual(expected, derivedKey))
    })
  })
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function createSession(userId: number, response: Response) {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = Math.floor(Date.now() / 1000) + sessionLifetimeSeconds
  database.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(userId, tokenHash, expiresAt)
  response.setHeader('Set-Cookie', `azza_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionLifetimeSeconds}${isProduction ? '; Secure' : ''}`)
}

function sessionUser(request: Request) {
  const cookieHeader = request.headers.cookie ?? ''
  const token = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith('azza_session='))?.slice('azza_session='.length)
  if (!token) return null
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  return database.prepare(`SELECT users.id, users.name, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).get(tokenHash, Math.floor(Date.now() / 1000)) as { id: number; name: string; email: string } | undefined ?? null
}

app.post('/api/auth/signup', async (request, response) => {
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
  const email = normalizeEmail(request.body?.email)
  const password = typeof request.body?.password === 'string' ? request.body.password : ''
  if (name.length < 2) return response.status(400).json({ error: 'Please enter your full name.' })
  if (!emailPattern.test(email)) return response.status(400).json({ error: 'Please enter a valid email address.' })
  const failedRequirement = passwordRequirements.find((requirement) => !requirement.test(password))
  if (failedRequirement) return response.status(400).json({ error: failedRequirement.message })
  try {
    const passwordHash = await hashPassword(password)
    const result = database.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, passwordHash)
    createSession(Number(result.lastInsertRowid), response)
    return response.status(201).json({ user: { name, email } })
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) return response.status(409).json({ error: 'An account with this email already exists.' })
    return response.status(500).json({ error: 'We could not create your account. Please try again.' })
  }
})

app.post('/api/auth/login', async (request, response) => {
  const email = normalizeEmail(request.body?.email)
  const password = typeof request.body?.password === 'string' ? request.body.password : ''
  const user = database.prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?').get(email) as { id: number; name: string; email: string; password_hash: string } | undefined
  if (!user || !(await verifyPassword(password, user.password_hash))) return response.status(401).json({ error: 'Email or password is incorrect.' })
  createSession(user.id, response)
  return response.json({ user: { name: user.name, email: user.email } })
})

app.get('/api/auth/me', (request, response) => {
  const user = sessionUser(request)
  if (!user) return response.status(401).json({ error: 'Not authenticated.' })
  return response.json({ user })
})

app.post('/api/auth/logout', (request, response) => {
  const cookieHeader = request.headers.cookie ?? ''
  const token = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith('azza_session='))?.slice('azza_session='.length)
  if (token) database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(crypto.createHash('sha256').update(token).digest('hex'))
  response.setHeader('Set-Cookie', 'azza_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
  return response.status(204).end()
})

database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Math.floor(Date.now() / 1000))
app.listen(port, () => console.log(`AZZA auth API listening on http://localhost:${port}`))
