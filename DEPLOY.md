Recommended deploy approach (Render / Railway)

Option A — Deploy backend separately (recommended):
1. Keep frontend on Vercel (fast) and deploy the backend to Render or Railway.
2. On Render or Railway create a new Web Service and point it to this repository (root).
3. Configure the build command: `npm install && npm run build`.
4. Run `npm run db:deploy` as the release/pre-deploy command to apply Prisma migrations.
5. Start command: `npm run start` (Procfile is included to help hosts detect the start command).
6. Set `DATABASE_URL` to the PostgreSQL connection string, plus `NODE_ENV=production`, `CLIENT_ORIGIN`, `PORT` (optional), and any SMTP secrets.
7. When hosting the frontend separately, set the frontend build environment variable `VITE_API_URL` to the deployed backend's base URL. Locally, leave it unset to use the Vite `/api` proxy.

Option B — Deploy the whole monorepo as one container (DigitalOcean App, Render Docker, etc.):
1. Add a Dockerfile that builds the frontend (`npm --prefix frontend run build`) and runs the backend.
2. Deploy the image to a container host (Render Docker, DigitalOcean App Platform, or VPS).

Existing data from a previous local database is not automatically copied into PostgreSQL.

## Local PostgreSQL setup (Windows)

1. Install PostgreSQL for Windows from the official PostgreSQL download page: https://www.postgresql.org/download/windows/. Include pgAdmin, set a password for the `postgres` user, and keep the default port `5432`.
2. Open pgAdmin, connect to the local server, and create a database named `azza_expenditure`.
3. In the project root `.env`, set `DATABASE_URL` to `postgresql://postgres:YOUR_PASSWORD@localhost:5432/azza_expenditure?schema=public`, replacing `YOUR_PASSWORD` with the password chosen during installation. URL-encode special characters in the password.
4. From the project root, run `npm run db:migrate` to create the tables, then `npm run dev` to start the app.

You can check the API and database connection at `http://localhost:4000/health`. It returns `{"status":"ok"}` when PostgreSQL is reachable.

## Local password-reset email (Gmail)

The local `.env` can use Gmail SMTP with `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, and `SMTP_SECURE=false`. Set `SMTP_USER` and `SMTP_FROM` to the Gmail address that sends the messages, and set `SMTP_PASS` to a Google App Password, not the account's normal password.

To create an App Password, enable 2-Step Verification on the Google account, then create an App Password in the Google Account security settings. Paste it into the root `.env` as `SMTP_PASS` (remove spaces if Google displays them), save the file, and restart `npm run dev` so the backend reloads the settings. Keep the App Password private and do not commit `.env`.

## API routes

The frontend calls the API with cookie credentials enabled. Sign-in and sign-up set the session cookie; expenditure routes require that session.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Create an account and sign in |
| `POST` | `/api/auth/login` | Sign in |
| `GET` | `/api/auth/me` | Restore the signed-in user |
| `POST` | `/api/auth/logout` | End the current session |
| `POST` | `/api/auth/request-password-reset` | Send a password-reset link |
| `POST` | `/api/auth/reset-password` | Set a new password using the email and token |
| `GET` | `/api/expenditures` | List the signed-in user's records |
| `POST` | `/api/expenditures` | Create an expenditure |
| `PUT` | `/api/expenditures/:id` | Update an expenditure owned by the signed-in user |
| `DELETE` | `/api/expenditures/:id` | Delete an expenditure owned by the signed-in user |
| `GET` | `/health` | Check API and PostgreSQL connectivity |

Create/update expenditure JSON uses `date` (`YYYY-MM-DD`), `category`, `subcategory`, `amount` (positive number), `currency` (three-letter code), `paymentMethod`, and optional `description`.
