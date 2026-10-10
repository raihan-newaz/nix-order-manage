# Courier address selection

Courier IDs are provider-specific. The `CourierLocation` table stores each provider's district/city, thana/zone, and area IDs with their parent IDs. District/thana names can be compared across providers, but one provider's numeric ID must never be sent to another.

Sources:

- Steadfast `GET /police_stations` returns districts and nested police stations; it does not provide a separate area list. Its source currently splits Dhaka into City and Sub-Urban, so an address that only says “Dhaka” is intentionally **not** auto-selected.
- Pathao city, zone and area endpoints provide a three-level location hierarchy. The cache is populated on demand and can be resumed with `npm run couriers:sync-locations` in the server directory. Each successfully synced parent is recorded in `CourierLocationSync`, including parents with no areas. The script spaces requests and backs off on rate limits; rerunning resumes missing parents rather than re-fetching everything.
- RedX OpenAPI supplies its own `/areas` list with unique area IDs. The admin syncs these into the RedX namespace and dispatch requires an exact RedX area ID and name. Pathao or Steadfast IDs are never sent to RedX. Sandbox may expose only a small simulated catalog.

The dispatch dialog matches explicit order location fields first, then a unique whole-name match in the address. Ambiguous or missing matches remain blank for the moderator to select. The backend verifies provider IDs and Pathao/Steadfast parent relationships before booking. Confirmed selections are saved on the order; Steadfast's booking address includes the selected district and thana text because its booking endpoint has no corresponding ID fields. If Pathao is rate-limiting an uncached area list, area remains optional while city and zone must be selected. Steadfast has a manual locality field because its current booking endpoint does not expose an area catalog.

Existing order editing remains available only before dispatch or closure to avoid silently changing a live courier booking. The edit dialog supports customer, address, payment and notes; product line items and courier status keep their dedicated workflows.
