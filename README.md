# eSIM Sender Multi-iPhone Admin Panel

A central admin system coordinating enrolled iPhones. Each iPhone runs an iOS
Shortcut and sends permitted messages through its own installed SIM/eSIM. The
server coordinates devices and campaigns; it does not send SMS itself.

## Migration stages
- **Stage 1:** TypeScript/NestJS API, PostgreSQL/Prisma, secure enrollment,
  device heartbeat and admin revocation.
- **Stage 2:** Next.js dashboard with device health and revocation.
- **Stage 3:** Campaign creation, E.164 recipient import, documented-consent
  attestation, sequential validation, suppression/duplicate checks, device
  assignment and campaign pause/stop.
- **Stage 3.1:** APILayer key manager at `/api-keys`. Import multiple keys
  one per line, view masked suffixes and request/failure counts, test, enable,
  disable or delete keys. Keys are encrypted at rest using AES-256-GCM and
  never returned to the browser. A database-locked rotation sequence allocates
  keys across concurrent validation requests. Rate-limited and transiently
  failing keys enter cooldown; authentication failures are marked and skipped.

**Quota note:** multiple keys do not automatically multiply APILayer quota.
Keys may share subscription limits. Use only keys you are authorized to use
and follow APILayer plan limits and terms.

## Setup
Requirements: Node.js 22+ and PostgreSQL.
1. Run `npm install` at the repository root.
2. Configure `DATABASE_URL`, `DEVICE_ENROLLMENT_CODE`,
   `DEVICE_TOKEN_SECRET`, `ADMIN_API_TOKEN`, and
   `API_KEY_ENCRYPTION_SECRET` on the API service.
3. Apply schema: `npm run db:push --workspace @esender/api`.
4. Run `npm run build` and `npm run typecheck`.
5. Start API with `npm run dev`; start web with
   `npm run dev --workspace @esender/web`.

Set the same server-only secrets on Railway API variables. Set
`ESENDER_API_URL` on the web service. Back up
`API_KEY_ENCRYPTION_SECRET` securely: without it stored keys cannot be
decrypted. Do not commit it or paste live keys into GitHub.

## Endpoints
- Campaigns: `/api/admin/campaigns` and nested campaign routes.
- Public opt-out: `POST /api/recipient/stop`.
- API keys: `GET|POST /api/admin/validation-keys`,
  `POST /api/admin/validation-keys/import`,
  `POST /api/admin/validation-keys/:id/test`,
  `PATCH|DELETE /api/admin/validation-keys/:id`.
Admin endpoints require `Authorization: Bearer <ADMIN_API_TOKEN>`.

**Sending safety:** ELIGIBLE is not a send command. This stage does not send SMS
from the server and does not implement batch approval, device polling or
delivery receipts. Only send to recipients with documented consent. iOS
Shortcuts check in when run; iOS does not guarantee continuous background work.
