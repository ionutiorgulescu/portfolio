# Server

SQLite file defaults to `server/data/portfolio.db` (`SQLITE_PATH`).

From the repo root:

```sh
yarn --cwd server db:migrate
yarn --cwd server dev
```

Copy one Supabase user's portfolios and positions into SQLite. `SEED_EMAIL` must match `auth.users.email`. UUIDs are preserved; `users.id` is that auth user id; the password is the `SEED_PASSWORD` hash. Price history and logos are skipped.

```sh
# server/.env — SUPABASE_DB_URL is a Postgres URI, not a Vite variable
yarn --cwd server import:supabase
```
