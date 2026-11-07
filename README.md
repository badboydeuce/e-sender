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


- **Stage 4.1:** Dashboard-managed global and per-device auto-reply rules, keyword/default matching, STOP suppression, cooldowns, duplicate inbound-message protection and reply audit history. iPhone integration is a later stage; this API does not receive SMS directly from the carrier.
- **Stage 4:** Explicit batch preview/approval, device-authenticated command
  polling, per-recipient message variant assignment, result reporting, campaign
  reports, and STOP propagation to queued batch items. Admins create a preview
  at `/batches`; only after approval can the assigned iPhone fetch the batch.

## Stage 4 device protocol
- `GET /api/device/command` with `x-device-token`: heartbeat plus next
  approved batch assigned to that device.
- `POST /api/device/batches/:id/report` with `x-device-token`: report each
  item as `SENT`, `FAILED`, or `SKIPPED`.
- Admin batch preview: `POST /api/admin/batches/preview` with
  `campaign_id` and `device_id`.
- Admin approval: `POST /api/admin/batches/:id/approve`.
- Admin cancellation: `POST /api/admin/batches/:id/cancel`.
- Campaign report: `GET /api/admin/campaigns/:id/report`.

The iPhone Shortcut must poll using its device token, show/send only the
returned approved items, and report each result. The API does not send SMS.
A batch already fetched by a Shortcut cannot be recalled from the phone; pause
or stop prevents future polls, but cannot retract a message already handed to
iOS. A real delivery receipt is not guaranteed by the iOS send action; report
`SENT` only when the Shortcut's send action succeeds, and retain any available
error details for failures.

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

## Stage 4.1 auto-reply management

- Dashboard: `/auto-reply`.
- Global master switch and independent per-iPhone enable/disable settings.
- Global rules apply across enabled devices. Device-specific rules override global rules.
- Matching order: device keyword, global keyword, device default, global default.
- Leave keyword blank to create a fallback/default reply. Keyword matching is case-insensitive.
- Cooldown is per sender and matched rule; set to 0 to disable.
- Incoming STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT is suppressed and added to the existing global suppression list; queued campaign items for that sender are skipped.
- `POST /api/device/incoming-message` with `x-device-token` and `{ "message_id", "from", "text" }` asks the server for a reply. A repeated device/message ID is idempotently ignored.
- `POST /api/device/auto-reply/:eventId/report` with `{ "status": "SENT" | "FAILED", "error"?: "..." }` records the iPhone Shortcut's send-action result.
- Admin endpoints live under `/api/admin/auto-reply` and require the admin bearer token.

The API does not receive SMS directly from the mobile network and does not send SMS. Stage 4.2 must configure the iOS Message automation to forward incoming-message details to this API and send a returned reply using the iPhone's own SIM/eSIM. iOS automation execution is not guaranteed to be continuously available. A reported `SENT` means the iOS send action succeeded, not that carrier delivery was confirmed.
