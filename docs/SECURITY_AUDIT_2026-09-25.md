# Security review — 2026-09-25

## Checks performed

| Area | Result |
| --- | --- |
| Client and storefront source/bundles vs local secret values | No matching secret values in either production bundle; no key-like literals found in application source. |
| Public storefront settings and product API | Payment API key excluded; public product responses use an explicit field list. |
| Integration configuration API | Courier, WooCommerce, messaging and payment secrets are masked or omitted; reveal endpoints require super administrator access. |
| Staff auth and role permissions | Added session revocation on role/status changes, blocked self-demotion and last active super administrator deactivation, restricted finance and purchase reads, redacted dashboard cost data by role, and aligned navigation with roles. |
| Cookie write requests | Origin allowlist enforced for cookie-authenticated mutations. |
| Customer data isolation | Guest checkout no longer attaches orders to an account or overwrites a registered profile; account order detail uses an explicit safe field list. |
| HTML content | Stored page HTML is sanitized on write and read with an allowlist. |
| Uploads | Image size, MIME and signatures checked; static serving narrowed to `/uploads/media`. |
| Rate limits | Global API, staff login, checkout, tracking and customer account limits present. |
| Dependencies | `npm audit` and `npm audit --omit=dev` report zero vulnerabilities in server, client and storefront at review time. |
| Build/schema | Server, client and storefront TypeScript/build checks and Prisma validation passed at review time. |

## Remaining work before a production security sign-off

- Existing guest profiles cannot be claimed online without verified phone ownership. Signup for an existing guest phone is blocked. Add an OTP or another verified recovery flow before enabling self-service claim.
- Existing orders linked to customer accounts before this fix may include guest orders placed with the same phone. Review and reconcile those historic links with verified ownership; no historical database rows were changed automatically.
- This was a source/configuration and local build audit. A deployed-site penetration test, TLS/reverse-proxy review, live response inspection, and credential rotation need the production environment.
- `is2FAEnabled` is stored but staff login does not enforce a second factor. Enable real second-factor verification before representing accounts as 2FA protected.
