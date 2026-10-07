# Server

SQLite file defaults to `server/data/portfolio.db` (`SQLITE_PATH`).

## OCI deploy

GitHub Actions (`oci-api-deploy` in `.github/workflows/deploy.yml`) rsyncs this directory to `~/portfolio-server/` over SSH. It never FTPs the server and never overwrites `.env` or SQLite files. Required secrets (repo or Prod environment):

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`

Create `~/portfolio-server/.env` on the VM once. On first deploy, `portfolio-api.service` is copied into systemd if missing, then `daemon-reload` and `enable --now`. Later deploys run `yarn install`, `yarn db:migrate`, and `sudo systemctl restart portfolio-api`.

From the repo root:

```sh
yarn --cwd server db:migrate
yarn --cwd server dev
```

Copy the live OCI SQLite file to `server/data/portfolio.db`. Snapshots on the VM with Python’s backup API (API can keep running), refuses the copy if `integrity_check` is not `ok`, and deletes local `-wal`/`-shm` first so they cannot corrupt the new file.

```sh
OCI_SSH_HOST=your.vm.ip yarn --cwd server db:pull
# optional: OCI_SSH_USER=ubuntu OCI_SSH_KEY=~/.ssh/id_ed25519
yarn --cwd server db:migrate
yarn --cwd server dev
```

Copy one Supabase user's portfolios and positions into SQLite. The email must match `auth.users.email`. UUIDs are preserved; `users.id` is that auth user id. If the user already exists in SQLite its password is kept, otherwise you are prompted for one. Price history and logos are skipped.

```sh
# server/.env — SUPABASE_DB_URL is a Postgres URI, not a Vite variable
yarn --cwd server import:supabase you@example.com
```

## Users

Users live only in the `users` table — there are no credentials in `.env`. Passwords are prompted (hidden) so they never land in shell history.

```sh
yarn --cwd server user:create you@example.com
yarn --cwd server user:password you@example.com   # also revokes that user's refresh tokens
```

## Registration

Disabled unless `ALLOW_REGISTRATION=true` (both endpoints return 403 otherwise). Sign-up is two steps, and the account only exists after the emailed code is confirmed:

1. `POST /auth/register` `{ "email" }` → 202 and emails a 6-digit code (valid 15 min). Calling it again resends; within 60s the code already sent stays valid. 409 if the email is registered, 502 if the email could not be sent.
2. `POST /auth/register/verify` `{ "email", "code", "password" }` → 201 `{ user }` with auth cookies. 400 `Invalid or expired code` for a wrong, expired, reused or exhausted code (5 attempts per code), or for a password outside 8 characters–72 bytes.

The password is only stored at step 2, so whoever can read the inbox chooses it. Codes are stored as an HMAC keyed with `SESSION_SECRET`.

Email goes out over SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`). Without `SMTP_HOST` the code is printed to the server log; the server refuses to start that way in production with registration enabled.

`/auth/login`, `/auth/register` and `/auth/register/verify` are rate limited per IP in memory (20, 5 and 20 requests per 15 minutes). Behind a reverse proxy, set `TRUST_PROXY=true` so the client IP is read from `X-Forwarded-For`; without a proxy leave it off, since that header can be forged.
