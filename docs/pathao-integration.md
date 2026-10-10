# Pathao Courier integration

This implementation follows the Pathao Merchant API documentation supplied for this project and the [Pathao webhook event document](https://docs.google.com/document/d/1MAIvWys6QXlfTisglgzYZ3RKQ1TR9FnpBYaTN-EF-Ss/edit?usp=sharing). It covers the documented API operations: OAuth password/refresh grants, store creation/listing, cities/zones/areas, delivery quote, single and native bulk order creation, and order short-info tracking. It also accepts every event named in the supplied webhook document. Merchant-panel-only features without a documented API are not automated.

## Setup

1. In Admin → Settings → Couriers, choose sandbox or live and enter the corresponding client ID/secret and merchant email/password. Save, load stores, select an approved pickup store, and enable Pathao dispatch.
2. Set `PUBLIC_API_URL` on the backend to the public HTTPS API origin, with a valid TLS certificate. The displayed callback URL is `/api/couriers/pathao/webhook`. Localhost is not reachable from Pathao.
3. Generate a long signing secret in Courier Settings. Copy the value into Pathao's `X-PATHAO-Signature` webhook configuration and save it here. Enter the separate integration verification value supplied by Pathao; the callback returns it in `X-Pathao-Merchant-Webhook-Integration-Secret` for Pathao's URL test. Both values are encrypted at rest and masked when read back.
4. Use a test order in Pathao's sandbox first. Check the order's Pathao timeline, status, fee, COD information, and return behavior before switching to live credentials. Sandbox and live credentials/stores are separate.

## Webhook behavior

- The receiver requires the configured signature header and compares it in constant time. It validates the event payload, ties order events to a Pathao consignment or a pending merchant order ID, records each event once, and ignores older status updates. Events with mismatched order/store identifiers are rejected.
- Supported order events: created, updated, pickup-requested, assigned-for-pickup, picked, pickup-failed, pickup-cancelled, at-the-sorting-hub, in-transit, received-at-last-mile-hub, assigned-for-delivery, delivered, partial-delivery, returned, delivery-failed, on-hold, paid, paid-return, exchanged, return-id-created, return-in-transit, and returned-to-merchant.
- Supported store events: created and updated. Selected-store activation changes update dispatch readiness.
- Delivery progress updates the OMS order stage. Confirmed delivery updates customer metrics and payment status only when the reported collected amount supports it. Stock is restored only on `order.returned-to-merchant`, not when a return is merely initiated. Payment/invoice and return details are retained in the timeline; a `paid` event alone does not claim merchant settlement because the webhook does not include a remitted amount.
- Native bulk requests return acceptance, not consignment IDs. Orders remain `BOOKING_REQUESTED` until an `order.created` webhook attaches the actual consignment. Network-uncertain bookings stay locked against automatic retries; an authorized admin can attach a verified Pathao consignment or explicitly unlock a retry after checking the Pathao merchant panel.

## Verification boundaries

Database schema and TypeScript production builds can be checked locally. Pathao cannot deliver webhooks to localhost, and no live consignment should be created solely to smoke-test the integration. End-to-end live verification needs the merchant's configured production credentials, approved store, public HTTPS URL, and a controlled test shipment.
