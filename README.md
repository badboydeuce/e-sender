# eSIM Sender Multi-iPhone Admin Panel

A central admin system for coordinating enrolled iPhones. Each iPhone runs an
iOS Shortcut and sends permitted messages through its own installed SIM/eSIM.
The server coordinates devices and campaigns; it does not send SMS itself.

## TypeScript migration

The migration is being delivered in stages. The existing Python/FastAPI starter
is intentionally retained during the transition so the working baseline is not
deleted before the TypeScript replacement reaches feature parity.

### Stage 1 — TypeScript API foundation

- Node.js + TypeScript + NestJS API in `apps/api`
- PostgreSQL persistence through Prisma
- Health endpoint at `GET /api/health`
- Protected iPhone enrollment using a shared enrollment code
- Unique high-entropy device token returned once at enrollment
- HMAC-SHA256 token digests stored in the database, never raw device tokens
- Authenticated heartbeat with last-seen timestamp
- Admin-protected device revocation
- Strict request DTO validation

### Local setup

Requirements: Node.js 22+ and PostgreSQL.

1. Run `npm install` at the repository root.
2. Copy `.env.example` to `.env` and set three independent random secrets
   (each at least 32 characters).
3. Set `DATABASE_URL` to your PostgreSQL connection string.
4. Run `npm run build`.
5. Run `npm run db:push --workspace @esender/api`.
6. Run `npm run dev`.

The API listens on port 3000 by default.

### API endpoints

- `GET /api/health`
- `POST /api/device/enroll` — body: `enrollment_code`, `name`, `platform: "iOS"`
- `POST /api/device/heartbeat` — header: `X-Device-Token`
- `POST /api/device/:deviceId/revoke` — header: `Authorization: Bearer <ADMIN_API_TOKEN>`

The raw device token is returned only once. Store it securely on its iPhone.
Never put the server-side enrollment code, token HMAC secret, or admin token in
an iOS Shortcut. Existing devices must enroll again when switching to the new
TypeScript token store.

### Railway deployment

The repository includes `railway.toml`. Create a Railway project from branch
`typescript/migration-foundation`, add a PostgreSQL service, and set
`DATABASE_URL`, `DEVICE_ENROLLMENT_CODE`, `DEVICE_TOKEN_SECRET`,
`ADMIN_API_TOKEN`, and `APP_ENV=production` in the API service variables.
Railway's database reference should point to the PostgreSQL service's
`DATABASE_URL`. The current bootstrap uses Prisma `db push` for this early
stage; before production rollout, replace it with reviewed Prisma migrations.

### Preserved product requirements

- Selected group/campaign sending coordinated across multiple iPhones.
- Each iPhone sends through its own SIM/eSIM using iOS Shortcuts.
- Batch sending with confirmation before each batch.
- Per-number validation followed immediately by sending when valid.
- Duplicate removal and opt-out exclusions, including STOP handling.
- Message variants from `Message.txt`, separated by `==`, with rotation.
- Leads from `Leads.txt` or manual paste, in international format.
- Per-device heartbeat, command polling, campaign assignment and reports.
- Only message recipients with documented consent.

iOS does not guarantee always-on background execution. Devices check in when
their Shortcut runs; a stop command cannot cancel a message already handed to iOS.


### Stage 2 — Next.js admin dashboard

A responsive Next.js + TypeScript dashboard lives in `apps/web`.
It currently provides admin-token sign-in (kept in page memory, not browser storage),
registered-device counts, online/active/revoked status, automatic 30-second refresh,
and device revocation. The dashboard calls server-side Next.js route handlers, which
proxy requests to the NestJS API; set `ESENDER_API_URL` on the web service.

For local development, run `npm install`, start the API with `npm run dev`,
then start the dashboard with `npm run dev --workspace @esender/web`.
The dashboard is available at `http://localhost:3001`. For a separate Railway web
service, set its root directory to `apps/web`, build with `npm install && npm run build`,
start with `npm run start`, and set `ESENDER_API_URL` to the public API service URL.
The API service continues to use the root `railway.toml` configuration.

Campaign authoring, batch confirmation, command delivery and report screens are not
implemented yet; they remain planned stages. The navigation labels for those areas are
visual placeholders, not active features.
