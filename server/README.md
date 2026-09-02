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

Copy one Supabase user's portfolios and positions into SQLite. `SEED_EMAIL` must match `auth.users.email`. UUIDs are preserved; `users.id` is that auth user id; the password is the `SEED_PASSWORD` hash. Price history and logos are skipped.

```sh
# server/.env — SUPABASE_DB_URL is a Postgres URI, not a Vite variable
yarn --cwd server import:supabase
```
