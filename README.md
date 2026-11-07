# eSIM Sender Multi-iPhone Admin Panel

A central admin system coordinating enrolled iPhones. Each iPhone runs an iOS
Shortcut and sends permitted messages through its own installed SIM/eSIM. The
server coordinates devices and campaigns; it does not send SMS itself.

## Migration stages
- **Stage 1:** TypeScript/NestJS API, PostgreSQL/Prisma, secure enrollment,
  device heartbeat and admin revocation.
- **Stage 2:** Next.js dashboard with device health and revocation.
- **Stage 3:** Campaign creation, E.164 recipient import, documented-consent
  attestation, sequential number validation, suppression/duplicate checks,
  device assignment and campaign pause/stop.
- **Stage 3.1:** APILayer key manager at `/api-keys`. Import multiple keys
  one per line, view masked suffixes and request/failure counts, test, enable,
  disable or delete keys. Keys are encrypted at rest using AES-256-GCM and
  never returned to the browser. A database-locked rotation sequence allocates
  keys across concurrent validation requests. Rate-limited and transiently
  failing keys enter cooldown; authentication failures are marked and skipped.

**Quota note:** multiple keys do not automatically multiply APILayer quota.
Keys may share subscription limits. Use only keys you are authorized to use
and follow APILayer plan limits and terms.

- **Stage 4:** Explicit batch preview/approval, device-authenticated command
  polling, per-recipient message variant assignment, result reporting, campaign
  reports, and STOP propagation to queued batch items. Admins create a preview
  at `/batches`; only after approval can the assigned iPhone fetch the batch.
- **Stage 4.1:** Dashboard-managed global and per-device auto-reply rules,
  keyword/default matching, STOP suppression, cooldowns, duplicate inbound
  message protection and reply audit history.
- **Stage 4.2:** An iOS Shortcut integration guide and machine-readable
  manifest for forwarding incoming Messages to the API, sending a returned
  reply through the iPhone's SIM/eSIM, and reporting the result. The guide
  documents how to build the automation in Apple's Shortcuts app; this
  repository does not generate or install an Apple-signed Shortcut file.

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
3. For local development, apply schema with
   `npm run db:push --workspace @esender/api`. For deployment, use
   `npm run db:migrate --workspace @esender/api`.
4. Run `npm run build`, `npm run typecheck`, and `npm test`.
5. Start API with `npm run dev`; start web with
   `npm run dev --workspace @esender/web`.

The initial migration is `20261107000000_initial`. Fresh databases are created
by `prisma migrate deploy`. For a database previously created with
`prisma db push`, back it up and verify that its schema exactly matches
`apps/api/prisma/schema.prisma`, then baseline it once with
`npx prisma migrate resolve --applied 20261107000000_initial --schema apps/api/prisma/schema.prisma`.
Do not baseline an unverified or partially migrated database. Railway runs
`prisma migrate deploy` and no longer performs an implicit schema push at
every restart.

Set server-only secrets on Railway API variables. Set `ESENDER_API_URL` on
the web service. Back up `API_KEY_ENCRYPTION_SECRET` securely: without it
stored keys cannot be decrypted. Never commit it or paste live keys into GitHub.

## Endpoints
- Campaigns: `/api/admin/campaigns` and nested campaign routes.
- Admin-initiated opt-out: `POST /api/admin/recipient/stop` (admin bearer token).
  Inbound STOP messages are processed through the authenticated device
  incoming-message endpoint.
- API keys: `GET|POST /api/admin/validation-keys`,
  `POST /api/admin/validation-keys/import`,
  `POST /api/admin/validation-keys/:id/test`,
  `PATCH|DELETE /api/admin/validation-keys/:id`.
- Auto-reply administration: `/api/admin/auto-reply`.
- Incoming auto-reply request: `POST /api/device/incoming-message`.
- Auto-reply send report: `POST /api/device/auto-reply/:eventId/report`.

Admin endpoints require `Authorization: Bearer <ADMIN_API_TOKEN>`.

## Sending safety and operational limits
- Only import and message recipients with documented consent.
- Recipient imports require explicit consent confirmation, E.164 format,
  deduplication, suppression checks and sequential number validation.
- A recipient is not sent a message merely because validation marks it
  eligible. Sending requires an administrator-created batch preview and
  explicit approval before an assigned iPhone can poll the batch.
- Authenticated inbound STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT requests add
  the number to the suppression list and skip queued items for that recipient.
- The API coordinates work but does not send SMS. The iPhone Shortcut sends
  through the device's selected SIM/eSIM.
- iOS Shortcuts do not guarantee continuous background execution. A stop
  command cannot retract a message already handed to iOS, and an iOS send
  action is not proof of carrier delivery.

## Stage 4.1 auto-reply management
- Dashboard: `/auto-reply`.
- Global master switch and independent per-device enable/disable settings.
- Global rules apply across enabled devices. Device-specific rules override global rules.
- Matching order: device keyword, global keyword, device default, global default.
- Leave keyword blank to create a fallback/default reply. Keyword matching is case-insensitive.
- Cooldown is per sender and matched rule; set to 0 to disable.
- Incoming STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT is suppressed and added to the existing global suppression list; queued campaign items for that sender are skipped.
- `POST /api/device/incoming-message` with `x-device-token` and
  `{ "message_id", "from", "text" }` asks the server for a reply. A repeated
  device/message ID is idempotently ignored.
- `POST /api/device/auto-reply/:eventId/report` with
  `{ "status": "SENT" | "FAILED", "error"?: "..." }` records the iPhone
  Shortcut's send-action result.
- Admin endpoints live under `/api/admin/auto-reply` and require the admin
  bearer token.

The API does not receive SMS directly from the mobile network and does not
send SMS. The iPhone automation forwards incoming-message details to this API
and sends a returned reply using the iPhone's own SIM/eSIM. iOS automation
execution is not guaranteed to be continuously available. A reported `SENT`
means the iOS send action succeeded, not that carrier delivery was confirmed.

## Stage 4.2 iPhone auto-reply Shortcut
- Follow [the iOS Shortcut integration guide](docs/ios-auto-reply-shortcut.md)
  to create a Personal Automation triggered by an incoming Message.
- The Shortcut forwards the incoming sender (E.164), message text, and a
  generated UUID to `POST /api/device/incoming-message` using its enrolled
  device token.
- It sends only a non-empty reply returned by the API, to the original sender,
  using the iPhone's own Messages/SIM configuration.
- It then reports `SENT` or `FAILED` to
  `POST /api/device/auto-reply/:eventId/report`.
- A machine-readable integration outline is in
  `docs/ios-auto-reply-shortcut.manifest.json`.
- iOS may require user confirmation or limit automation execution. The guide
  requires testing the actual device/iOS version; the server cannot bypass
  iOS restrictions.
- This repository documents the native Shortcut workflow; build the
  automation in the Shortcuts app using the guide.
