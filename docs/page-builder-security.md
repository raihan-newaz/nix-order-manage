# Studio threat model and security boundaries

## Trust boundaries

Public visitors receive only validated published HTML/CSS. Staff-only endpoints
require the existing JWT/cookie authentication, current account status and session
version. Builder capability middleware reloads roles and granular permissions.
SUPER_ADMIN always has all builder capabilities; OPERATIONS_MANAGER defaults to
access/edit/publish/templates. Other roles default deny. User.permissions may
override boolean `builder.access`, `builder.edit`, `builder.publish`, and
`builder.templates` and `builder.submissions` keys. No client-only authorization is relied on.

Super administrators can manage these capabilities from the page manager. Updates
use optimistic concurrency, preserve unrelated permission keys and write an audit
record. Auth profiles expose only effective builder access for navigation; raw
permission storage is never returned in staff login/profile responses.

The current boundary is whole-document editing. Content-only versus style or
structure permissions require server-side document diffs and are not implemented.
Do not grant edit to a content-only role expecting restricted visual changes.

## Controls

| Threat | Enforcement |
| --- | --- |
| Stored XSS / markup injection | Escaped text/attributes, allowlisted semantic tags and URL schemes, no raw HTML/script widgets |
| CSS injection/exfiltration | Property allowlist; reject braces, declaration separators, markup, escapes, at-rules, comments, url and image-set |
| Prototype pollution | Recursive key screening before schema validation; strict document/node objects |
| CSRF | Existing server-wide origin guard on cookie-authenticated writes, SameSite cookies, CORS allowlist |
| Unauthorized publishing / IDOR | Auth + access + per-action capability on every builder endpoint; page revisions queried by both revision and page ID |
| SQL injection / mass assignment | Prisma parameterized queries; explicit server-created fields; strict payload schemas |
| Resource exhaustion | Request/document/node/depth/expansion limits, bounded list APIs, existing API rate limiter |
| Concurrent overwrite | Transactional baseVersion compare-and-swap and immutable revision insertion |
| Draft leakage | Public route reads only published snapshot; authenticated preview has no-store and noindex |
| SSRF/webhooks | No server-side remote fetching or webhook action in the foundation |
| ZIP Slip/path traversal | JSON-only import; no archive extraction; no input-controlled filesystem paths |
| Unsafe uploads/SVG | Existing image library retained; no new upload endpoint or SVG capability |
| Script execution | Public CSP denies scripts, frames, objects and connections; form actions are same-origin only |
| Form CSRF/replay | Expiring HMAC bound to same-site HttpOnly cookie, page/form/published version, exact allowed origin, unique request UUID |
| Form injection/spam | Published field allowlist, type/required/bounds/length checks, honeypot, per-IP rate limit, no arbitrary regex or upload field |
| Submission access/CSV formulas | Dedicated submission capability, audited status/deletion, formula-neutralized CSV export |

Public image/media URLs can load remote HTTP(S) assets in visitors' browsers.
Operators should host assets they control; remote assets have privacy implications.
CSS is document-scoped. Custom attributes cannot overwrite builder control attributes
or introduce `on*` handlers. Export contains document content, never staff cookies,
credentials, revision authors or permissions.

## Operational limits

These protections are not a claim of a complete security audit of the pre-existing
OMS. Enforce HTTPS, proper production secrets and trusted proxy configuration in
deployment. Test authenticated origin handling through the actual reverse proxy.
Public cache checks the DB version on each request, then reuses a bounded rendered
HTML cache; no private-user dynamic output is cached publicly. Do not add sensitive
user bindings without a private response/cache design.

Security regression tests cover scripts, unsafe URLs/CSS, malicious object keys,
depth, cycles, permissions, cross-origin writes, draft preview authentication,
stale and concurrent writes. Native form tests cover required/type validation,
token forgery, expiry and cookie/version binding, replay protection, private
submissions, review/deletion and CSV safety. Forms allow at most 50 fields with
2,000 characters per submitted value. Form-bearing pages bypass the public cache
and return no-store so session tokens cannot be shared by a CDN. Distributed rate
limiting/CAPTCHA, file uploads, webhooks and custom code need separate reviews.
