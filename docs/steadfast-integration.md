# Steadfast Courier integration

Reference: [Steadfast merchant API and webhook documentation](https://docs.google.com/document/d/12gvGliiIrF648ob2IaLXO3mgEWgGZdtd30GO8SGs-I0/edit?usp=sharing).

## Setup

1. In **Settings → Couriers**, enter a dedicated Steadfast API Key and Secret Key, enable dispatch, then save and use **Test connection**. The API endpoint is fixed to `https://portal.packzy.com/api/v1`; the test calls `GET /get_balance` and does not create a shipment.
2. Generate a separate webhook authentication token, save it, and configure that exact token and the shown callback URL in the Steadfast merchant panel. The webhook requires both `Authorization: Bearer <token>` and `X-Signature` (HMAC-SHA256 of the raw JSON body using the token), plus `Idempotency-Key`. The token is not the API secret.
3. For live webhooks, set `PUBLIC_API_URL` to a public HTTPS server URL. `localhost` cannot receive Steadfast callbacks. If the server runs behind a proxy, configure the proxy to preserve raw request bodies and the three authentication headers.
4. Dispatch an eligible order from Orders. Single bookings use `/create_order`; selected-order bulk bookings use `/create_order/bulk-order/extended`, so each entry is handled separately. A returned consignment ID and tracking code are saved to the order.

## Available operations

- Order details: tracking history, live status refresh with return-aware status, signed event timeline, and return request.
- Couriers: balance, payouts and payout details, return requests and details, police stations, pickup request, and customer fraud score. Fraud score is informational only; `null` means no known history.
- API: ping, status by consignment/invoice/tracking code, and the above operations under `/api/couriers/steadfast`.
- Signed delivery-status webhooks synchronize the order. Stock is restored only for a confirmed `cancelled_return_received` outcome; partial returns require manual quantity reconciliation.

## Operational safety

- API credentials and webhook token are encrypted at rest and masked in settings responses. Use distinct keys per integration and rotate any credentials exposed in a shared document.
- A network/5xx or ambiguous bulk outcome leaves a booking in `BOOKING_UNCERTAIN`. Do not dispatch it again until the Steadfast merchant panel confirms the invoice did not book. Operations managers can verify and attach a consignment using its invoice tracking history; they can unlock retry only after manually confirming no booking exists. Both actions are audited.
- The return request and pickup request actions mutate the live merchant account and require an explicit confirmation in the UI.
- Webhooks are deduplicated by hashed idempotency key. Invalid signatures are rejected before any database changes.
- Test connection, ping, and status queries are read-only. They do not prove a live booking can be created; validate a small real order with the merchant after configuring credentials and webhook.
