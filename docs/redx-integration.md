# RedX OpenAPI integration

Use Courier Settings to choose sandbox or production and save that environment's API token. Sandbox operations are simulated. The token is encrypted in `CourierConfig.apiKey`; the database column is `TEXT` so an encrypted JWT fits. Switching environments requires entering the token for the new environment.

In Courier Settings, run **Test connection**, then **Sync RedX areas**. The dispatch dialog uses RedX's own area IDs. It can suggest an area only when the order address matches uniquely; the moderator can search and choose another. Pickup store is optional for booking and can be created from the Couriers page. The fee estimator uses the selected store's pickup area.

RedX uses `/parcel` to create a parcel, `/parcel/info/{tracking_id}` for details, `/parcel/track/{tracking_id}` for updates, `/parcels` for cancellation and delivery address change requests, and the documented pickup store, area and charge endpoints. A booking claim guards against duplicate submissions. If RedX accepts a booking but its response is lost, the order stays uncertain until the merchant verifies and attaches the tracking ID or confirms that no booking exists. Update requests are not reflected in the local order until RedX confirms a new status or the moderator verifies the change.

For live status callbacks set `PUBLIC_API_URL` to a public HTTPS origin. Add a separate random callback token in Courier Settings, then register `https://YOUR_API/api/couriers/redx/webhook?token=YOUR_CALLBACK_TOKEN` in the RedX merchant portal. The callback validates the token, payload, tracking ID and invoice, records duplicate-safe events, and only applies newer status updates. A localhost callback cannot be reached by RedX.

The sandbox token provided for local testing returned one area, one pickup store and a charge estimate. A synthetic sandbox parcel was created and tracked successfully. At that time the sandbox parcel-info and parcel-update endpoints returned HTTP 503, so those two flows need a retest when RedX restores them. A production token and public HTTPS callback URL are required before live dispatch and webhook verification.
