# Mkety Media commercial model

## Customer types

### Normal/self-service customer
- Signs up without Mkety staff.
- Selects an active public plan.
- Pays before service activation.
- Creates logical buckets, folders and files without support.
- Uploads directly to storage using short-lived signed URLs.
- Copies stable `assets.mkety.app` URLs.
- Can rename/move/delete objects, manage team access within plan limits, inspect usage and buy prepaid add-ons.
- Uses Mkety-managed shared storage pools. The physical cloud provider is hidden by default.
- Cannot see or obtain Mkety cloud credentials.

### Enterprise customer
Everything above, plus operator-configurable capabilities:
- higher/custom quotas and negotiated pricing;
- dedicated physical bucket/storage account where required;
- pinned provider/region;
- private buckets and signed delivery;
- custom delivery hostname;
- more team seats/API keys;
- invoice/manual settlement;
- optional SLA/support and migration assistance.

Enterprise does NOT mean the customer needs Mkety staff for ordinary operations. The customer remains self-service after onboarding.

## Billing safety

Never allow unbounded post-paid cloud usage.

1. Plans are fixed-price monthly subscriptions with included quotas.
2. Starter uses a hard cap.
3. Paid higher plans may use a prepaid usage wallet.
4. Uploads are blocked before storage would exceed the purchased allowance.
5. New multipart upload parts are rejected once quota reservation is exhausted.
6. Public delivery is metered. At warning thresholds send notifications.
7. Provider pools with material egress exposure (AWS/GCP/Azure/OCI depending on region) require either:
   - prepaid delivery balance; or
   - BYO-cloud billing; or
   - an operator-approved enterprise contract.
8. Never silently create a negative customer balance.
9. Unpaid renewal: immediately block new uploads/mutations, keep a short operator-configurable read-only grace period, then suspend public delivery.
10. Deletes remain available while suspended so customers can reduce storage.

Recommended thresholds:
- 70%: dashboard warning.
- 85%: email/Telegram warning.
- 95%: urgent warning.
- 100%: hard cap unless a prepaid wallet has sufficient balance.

## Manual payment

Do not require customers to upload bank-transfer screenshots.

Flow:
1. Customer chooses Local Bank Transfer.
2. Portal creates an invoice/reference and displays bank instructions.
3. Operator receives Telegram/email notification with invoice ID, tenant, amount and Approve/Reject action link.
4. Operator verifies the bank credit outside the portal.
5. Approval creates a one-time signed approval token and marks the invoice paid.
6. Customer receives email and optionally Telegram confirmation. Access is enabled automatically.

The one-time approval token should be consumed server-to-server; do not make the customer type an access code unless an operator specifically chooses that fallback.

## Automated crypto payment

Reuse repository secrets:
- NOWPAYMENTS_API_KEY
- NOWPAYMENTS_IPN_SECRET

NOWPayments IPN is verified server-side. Only final/accepted settlement states may activate/renew service. Payment identifiers and webhook event IDs must be idempotent.

## Operator console

Mkety operators must be able to change without code deployment:
- plans/prices/currency/display order;
- quotas and overage policy;
- provider enabled/disabled state;
- provider assignment/pool priority;
- customer plan, status and custom limits;
- grace periods;
- payment methods;
- local bank details;
- NOWPayments availability;
- notification destinations;
- allowed file types/max object size;
- cache defaults;
- feature flags;
- maintenance notices;
- enterprise custom pricing;
- suspend/restore tenant;
- issue credits/add prepaid balance;
- usage corrections with audit trail.

Secrets are the exception: credentials remain in Cloudflare/secret storage and the operator UI only shows whether each required secret is configured.
