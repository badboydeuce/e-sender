# eSIM Sender Multi-iPhone Admin Panel

A central admin system for coordinating enrolled iPhones. Each iPhone runs an
iOS Shortcut and sends permitted messages through its own installed SIM/eSIM.
The server coordinates devices and campaigns; it does not send SMS itself.

## TypeScript migration

The migration is delivered in stages. The existing Python/FastAPI starter is
intentionally retained until the TypeScript replacement reaches feature parity.

### Stage 1 — TypeScript API foundation

- Node.js + TypeScript + NestJS API in `apps/api`
- PostgreSQL persistence through Prisma
- Health endpoint at `GET /api/health`
- Protected iPhone enrollment using a shared enrollment code
- High-entropy device token returned once; HMAC-SHA256 digest stored
- Authenticated heartbeat and admin-protected device revocation
- Strict request DTO validation

### Stage 2 — Admin dashboard and device management

A responsive Next.js + TypeScript dashboard lives in `apps/web`. It provides
admin-token authentication, device counts, heartbeat status, automatic refresh,
and device revocation. Server-side route handlers proxy requests to the API.

### Stage 3 — Campaigns and consent-aware recipient management

- Create campaigns with message variants and configurable batch size.
- Import recipient numbers by paste or text-list input in E.164 format.
- Require explicit operator confirmation that every imported recipient opted in.
- Process numbers sequentially: format check, global suppression check, duplicate
  check, then APILayer Number Verification. Each passing mobile number becomes
  `ELIGIBLE` immediately; the entire list is not held for a separate validation
  queue.
- Reject invalid format, duplicate, suppressed, invalid/non-mobile and provider-error
  records with separate statuses.
- Assign only active enrolled devices to a campaign through the admin API.
- Pause or stop a campaign.
- Public `POST /api/recipient/stop` endpoint adds a number to the global suppression
  list and marks its existing campaign records opted out.

**Important:** eligible means the number passed the provider's validity/mobile
check; it is not a send command. This stage does not yet implement batch approval,
device command polling, or delivery receipts. Those are the next stage. No SMS
is sent by the server. Sending remains on the iPhone Shortcut, which must check
campaign state and opt-out status before each batch and confirm with the operator.

### Local setup

Requirements: Node.js 22+ and PostgreSQL.

1. Run `npm install` at the repository root.
2. Set `DATABASE_URL`, `DEVICE_ENROLLMENT_CODE`, `DEVICE_TOKEN_SECRET`,
   and `ADMIN_API_TOKEN` on the API service. Use independent random secrets
   (at least 32 characters).
3. Set `APILAYER_API_KEY` on the API service. Never expose it in the browser,
   Shortcut, or Git.
4. Run `npm run db:push --workspace @esender/api` to apply the Prisma schema.
5. Run `npm run build` and `npm run typecheck`.
6. Start the API with `npm run dev`; start the web app with
   `npm run dev --workspace @esender/web`.

The API listens on port 3000 and the dashboard on port 3001 by default.

### API endpoints

- `GET /api/health`
- `POST /api/device/enroll`
- `POST /api/device/heartbeat`
- `GET /api/admin/devices`
- `POST /api/admin/devices/:deviceId/revoke`
- `GET|POST /api/admin/campaigns`
- `GET /api/admin/campaigns/:id`
- `PATCH /api/admin/campaigns/:id/status`
- `POST /api/admin/campaigns/:id/devices`
- `GET /api/admin/campaigns/:id/recipients`
- `POST /api/admin/campaigns/:id/recipients/import`
- `POST /api/recipient/stop` (public opt-out endpoint)

Admin endpoints require `Authorization: Bearer <ADMIN_API_TOKEN>`.
The raw device token is returned only once. Never put server-side enrollment,
admin or validation secrets in an iOS Shortcut.

### Railway deployment

Deploy the API from the repository root with PostgreSQL attached. Set
`DATABASE_URL`, `DEVICE_ENROLLMENT_CODE`, `DEVICE_TOKEN_SECRET`,
`ADMIN_API_TOKEN`, and `APILAYER_API_KEY` as API service variables.
Deploy the web service separately with root directory `apps/web`, and set
`ESENDER_API_URL` to the public API service URL. Before production rollout,
replace the early-stage Prisma `db push` workflow with reviewed Prisma migrations.

### Preserved product requirements

- Selected group/campaign sending coordinated across multiple iPhones.
- Each iPhone sends through its own SIM/eSIM using iOS Shortcuts.
- Batch sending with confirmation before each batch.
- Per-number validation immediately before eligibility.
- Duplicate removal and global opt-out exclusions, including STOP handling.
- Message variants separated by `==`, with rotation to be implemented in the
  device delivery stage.
- Leads from `Leads.txt` or manual paste, in international format.
- Per-device heartbeat, campaign assignment and reports.

Only message recipients with documented consent. iOS does not guarantee
always-on background execution. Devices check in when their Shortcut runs;
a stop command cannot cancel a message already handed to iOS.
