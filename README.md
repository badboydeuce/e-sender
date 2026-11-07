# eSIM Sender Multi-iPhone Admin Panel

A modular FastAPI starter for managing enrolled iPhones, campaigns, device commands,
and delivery reports. iPhones perform sending locally through their own SIM/eSIM
using an explicitly configured iOS Shortcut. The server does not send SMS itself.

## Architecture
- `app/api/`: HTTP routes grouped by feature
- `app/core/`: settings and authentication helpers
- `app/db/`: SQLAlchemy engine and session management
- `app/models/`: SQLAlchemy models
- `app/schemas/`: request/response validation
- `app/services/`: business logic
- `app/web/`: dashboard static assets and templates
- `tests/`: automated tests

## Local setup
1. Create a virtual environment: `py -m venv .venv`
2. Activate it: `.venv\\Scripts\\activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Copy `.env.example` to `.env` and set strong, unique secrets.
5. Start: `uvicorn app.main:app --reload`
6. Open `http://127.0.0.1:8000`

## Device registration and authentication
Configure independent random secrets of at least 32 characters:
- `DEVICE_ENROLLMENT_CODE`: shared secret used only for initial enrollment.
- `DEVICE_TOKEN_SECRET`: server-side key used to create keyed token digests.
- `ADMIN_API_TOKEN`: secret for protected administrative endpoints.

In production the app rejects placeholder or short secrets. Keep `.env` out of Git
and never put server-side secrets in an iOS Shortcut.

Enroll with `POST /api/device/enroll` and JSON containing `enrollment_code`,
`name`, and `platform: "iOS"`. The response contains a one-time `device_token`.
Store it securely on the iPhone; it cannot be retrieved from the server later.
Send it on device requests in the `X-Device-Token` header. The server stores only
an HMAC-SHA256 digest. Heartbeat is `POST /api/device/heartbeat`.

An admin can revoke a device with `POST /api/device/{device_id}/revoke` using
`Authorization: Bearer <ADMIN_API_TOKEN>`. Revoked tokens are rejected.

**Existing enrolled devices must enroll again** after this update because their
old plain SHA-256 token digests are incompatible with the new keyed digest.

## Production notes
Use Alembic migrations before deploying schema changes, PostgreSQL, HTTPS,
a managed secret store, backups, rate limits on enrollment and admin routes,
audit logging, and an authenticated admin account with MFA. Rotate the enrollment
code after provisioning devices. The included table creation on startup is for
development only; use Alembic in production.

## Device protocol
A device enrolls once, stores its token securely, then periodically sends an
authenticated heartbeat, fetches assigned configuration and pending commands,
and reports each permitted action/result. The iOS Shortcut must check campaign
state at safe checkpoints. Pause/stop cannot cancel a message already handed to
iOS. iOS does not guarantee always-on background execution.

## Consent and safety
Use only recipient lists with documented permission. Keep opt-out exclusions active,
honor STOP requests, avoid duplicate sends, and apply per-device and per-campaign
rate limits. This starter does not implement message blasting or bypass
platform/carrier restrictions.
