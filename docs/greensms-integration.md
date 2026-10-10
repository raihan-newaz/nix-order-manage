# GreenSMS / GreenWeb SMS

The integration follows the BD Bulk SMS English manual for GreenWeb: HTTPS `POST https://api.bdbulksms.net/api.php?json` with JSON `{ token, smsdata: [{ to, message }] }`. An SMS is logged as sent only when that recipient's response has `status: "SENT"`. The documented demo token returns a simulated `SENT` response without delivering a message, so it is rejected when enabling the gateway.

In **Admin → Messages**, paste a real panel token and enable GreenSMS. The token is encrypted in MySQL and masked when settings are read. The server fixes the provider URL so admin input cannot redirect a credential to another host. The test form accepts a Bangladesh mobile number and sends one SMS when the gateway is enabled.

Short SMS templates are installed for order received, confirmed, packing, courier pickup, courier booking, in transit, out for delivery, delivered, partial delivery, hold, cancellation, return, and payment received. Each can be edited, changed to SMS/WhatsApp/both, or disabled independently. They use `{order_number}`, `{grand_total}`, `{cod_amount}`, `{customer_name}`, `{courier_name}`, `{tracking_code}`, and `{tracking_url}`. Long or Bangla messages can use multiple billable SMS segments; the editor displays character count.

Order creation, manual status changes, successful courier booking, courier status webhooks and verified online payment trigger the corresponding templates. Each order, stage, channel and template has one unique log key to prevent duplicate sends after webhook retries. A disabled gateway does not attempt delivery or create a misleading sent log. Message logs show gateway acceptance or failure; the provider's `SENT` response confirms API acceptance, not handset delivery.

API reference: https://bdbulksms.com/bulk-sms-api-bd-english.php
