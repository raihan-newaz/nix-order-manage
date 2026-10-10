# NIX security and deployment notes

## Production requirements

- Set `NODE_ENV=production`, a unique `JWT_SECRET`, and a separate `DATA_ENCRYPTION_KEY`, each with at least 32 characters.
- Set `CLIENT_URL` to the exact HTTPS admin and storefront origins, separated by commas.
- Terminate TLS at the reverse proxy and do not expose the SQLite file, `.env`, backups, or uploads directory as source files.
- Configure a strong, unique WooCommerce webhook secret in both WooCommerce and NIX Settings.
- Replace any integration credential that was previously shared, committed, or entered as demo data.
- Back up the database before each deployment and test restore procedures regularly.
- Back up `DATA_ENCRYPTION_KEY` in a secure secret manager. Losing or changing it makes stored integration credentials unreadable.

## Controls in the application

- Authentication uses an HttpOnly, SameSite cookie; browser JavaScript cannot read the session token.
- CORS and authenticated Socket.IO connections use the configured origin allowlist.
- Login and API endpoints are rate limited, and privileged mutations enforce server-side roles.
- Integration secrets use authenticated AES-256-GCM encryption at rest, are masked in API responses, and audit records do not contain password hashes.
- WooCommerce webhooks require HMAC verification; remote integration URLs reject private-network targets.
- Media uploads enforce size, MIME type, and file-signature checks.
- Order cancellation/return stock changes run transactionally and terminal transitions are idempotent.

## Operational checks

Run `npm audit` and `npm run build` inside `server`, `client`, and `storefront` before deployment. Run `npx prisma validate` and back up the database before applying schema changes.
