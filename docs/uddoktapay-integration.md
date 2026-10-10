# UddoktaPay integration plan and operations

## Payment lifecycle

1. A super admin enters their UddoktaPay installation's HTTPS base URL and API key in Admin → Settings → Payments. The key is AES-256-GCM encrypted at rest and never included in public settings responses. The gateway is off by default.
2. Checkout recalculates product prices, stock and delivery charge on the server. COD stays available. For online payment, a pending order and a payment-attempt record are created before calling `POST /api/checkout-v2` with a unique attempt ID in metadata.
3. The customer is sent only to a payment URL on the configured gateway origin. If charge initiation fails, the order is cancelled and reserved stock is restored.
4. A return callback or webhook triggers `POST /api/verify-payment` from the backend. Browser query parameters or webhook payload alone never mark an order paid. Verification requires `COMPLETED`, matching invoice, order/attempt metadata, and exact server-calculated amount. The invoice and transaction IDs are unique; a conditional database update makes repeat notifications idempotent.
5. A payment that is not verified remains pending. Operations staff must reconcile pending orders before dispatch or stock release. Do not treat a cancelled browser visit as proof that no payment occurred.
6. Orders with a gateway payment attempt cannot be permanently deleted; retaining the order and attempt protects payment audit history.

## Deployment checklist

- Configure `STOREFRONT_URL` and `PUBLIC_API_URL` as public HTTPS origins in the backend production environment. `PUBLIC_API_URL` must expose the `/api/storefront/payment/return/...` and `/api/storefront/payment/webhook` routes.
- Set a unique production `DATA_ENCRYPTION_KEY` (at least 32 characters) and back it up securely. Losing it makes saved API credentials unreadable. Never commit keys to the repository.
- Test with UddoktaPay sandbox and the account-specific API key, including success, cancel, timeout, duplicate return/webhook, amount mismatch, and API outage. Then switch to the live installation URL and live key.
- Check that the payment hostname resolves publicly and uses valid HTTPS. Webhooks cannot reach a local-only `localhost` server; local testing can use the return URL, but full webhook testing requires a public HTTPS endpoint.
- Review pending online orders regularly. Refunds and automatic expiry/reconciliation are not enabled by this integration; handle those through the provider/admin workflow before fulfilment.

No payment gateway can offer a literal 100% security guarantee. Review provider settings, infrastructure TLS, server access controls, dependency updates, logs and live transaction reconciliation before accepting production payments.
