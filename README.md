# eSIM Sender Multi-iPhone Admin Panel

A modular FastAPI starter for managing enrolled iPhones, campaigns, device commands,
and delivery reports. iPhones perform sending locally through their own SIM/eSIM
using an explicitly configured iOS Shortcut. The server does not send SMS itself.

## Architecture

- `app/api/`: HTTP routes grouped by feature
- `app/core/`: settings, authentication helpers, logging
- `app/db/`: SQLAlchemy engine and session management
- `app/models/`: database models
- `app/schemas/`: request/response validation
- `app/services/`: business logic
- `app/web/`: dashboard static assets and templates
- `tests/`: automated tests

## Local setup (development)

1. Create a virtual environment: `py -m venv .venv`
2. Activate it: `.venv\Scripts\activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Copy `.env.example` to `.env` and set strong, unique secrets.
5. Start: `uvicorn app.main:app --reload`
6. Open `http://127.0.0.1:8000`

The included database setup creates tables on startup for development. For production,
use Alembic migrations, PostgreSQL, HTTPS, a managed secret store, backups, rate limits,
audit logging, and an authenticated admin account with MFA.

## Device protocol

A device enrolls once, stores its device token securely, then periodically:
- sends a heartbeat;
- fetches its assigned configuration and pending commands;
- reports each permitted action/result.

The iOS Shortcut must check campaign state at safe checkpoints. Pause/stop cannot
cancel a message already handed to iOS. iOS does not guarantee always-on background
execution, so the device checks in when the Shortcut runs.

## Consent and safety

Use only recipient lists with documented permission. Keep opt-out exclusions active,
honor STOP requests, avoid duplicate sends, and apply per-device and per-campaign
rate limits. This starter deliberately does not implement message blasting or bypass
platform/carrier restrictions.
