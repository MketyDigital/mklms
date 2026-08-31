# External managed-hosting billing

MkLMS keeps its existing monthly managed-hosting model and manual operator controls. Automatic payment is an optional additional settlement path; it does not replace `PENDING`, `PAID`, or `WAIVED`.

## Manual controls

When `MKLMS_MANAGED_HOSTING_ENABLED=true`, open **Admin -> Hosting & Usage**. The monthly operator editor appears below the amount due and supports:

- monthly minimum/floor amount;
- `PENDING`;
- `PAID`;
- `WAIVED`;
- operator note.

Saving requires both a valid admin session and the separate `MKLMS_MANAGED_HOSTING_OPERATOR_KEY`. The operator key must be at least 16 characters. This manual path remains available even when automatic billing is enabled.

## Automatic flow

```text
Admin -> Hosting & Usage -> Pay now
  -> MkLMS calculates current month amount on the server
  -> signed request to mkety-managed-hosting-billing Worker
  -> Worker creates NOWPayments invoice
  -> admin pays
  -> NOWPayments sends signed IPN to billing Worker
  -> Worker accepts automatic settlement only for finished
  -> Worker sends signed settlement to this MkLMS installation
  -> existing managed_hosting_months row becomes PAID
```

If a month is already `PAID` or `WAIVED`, MkLMS refuses to create another automatic invoice.

## MkLMS application variables

```text
MKLMS_MANAGED_HOSTING_ENABLED=true
MKLMS_MANAGED_HOSTING_MIN_USD=15
MKLMS_MANAGED_HOSTING_MAX_USD=50
MKLMS_MANAGED_HOSTING_OPERATOR_KEY=<long manual-operator secret>
MKLMS_MANAGED_PAYMENT_URL=<optional fallback payment URL>
MKLMS_MANAGED_HOSTING_NOTICE=<optional notice>

MKLMS_BILLING_SERVICE_URL=https://<billing-worker>.workers.dev/
MKLMS_BILLING_INSTALLATION_ID=spf-mklms
MKLMS_BILLING_SHARED_SECRET=<long unique per-installation secret>
```

`MKLMS_BILLING_SHARED_SECRET` is an inter-service authentication secret, not a payment-provider credential. Generate a different secret for every managed customer installation.

## Billing Worker variables

The standalone Worker in `workers/billing/` deliberately reuses the same NOWPayments environment variable names as the legacy `MketyDigital/Mkety` production repository:

```text
NOWPAYMENTS_API_KEY=<same existing secret value is allowed>
NOWPAYMENTS_IPN_SECRET=<same existing secret value is allowed>
MKETY_BILLING_CUSTOMERS_JSON=<secret customer registry JSON>
```

The Worker does not require access to any customer PostgreSQL database.

Example customer registry:

```json
{
  "spf-mklms": {
    "settlementUrl": "https://CUSTOMER_HOST/api/managed-hosting/settlement",
    "sharedSecret": "THE_SAME_VALUE_AS_MKLMS_BILLING_SHARED_SECRET",
    "successUrl": "https://CUSTOMER_HOST/admin/hosting?payment=success",
    "cancelUrl": "https://CUSTOMER_HOST/admin/hosting?payment=cancelled"
  }
}
```

Store this JSON as a Worker secret. Do not commit real secrets or customer URLs containing credentials.

## Deploy the billing Worker

From the repository root:

```bash
npx wrangler secret put NOWPAYMENTS_API_KEY --config workers/billing/wrangler.jsonc
npx wrangler secret put NOWPAYMENTS_IPN_SECRET --config workers/billing/wrangler.jsonc
npx wrangler secret put MKETY_BILLING_CUSTOMERS_JSON --config workers/billing/wrangler.jsonc
npx wrangler deploy --config workers/billing/wrangler.jsonc
```

After deployment, copy the Worker base URL into `MKLMS_BILLING_SERVICE_URL` for the managed installation.

## Security differences from legacy Mkety webhook

The new Worker intentionally fails closed:

- missing NOWPayments IPN secret -> no settlement;
- missing `x-nowpayments-sig` -> reject;
- invalid signature -> reject;
- unknown/malformed order -> reject;
- unknown customer installation -> reject;
- `confirmed`, `sending`, `partially_paid`, or other non-final states -> do not mark paid;
- only `finished` triggers automatic `PAID` settlement.

The Worker verifies NOWPayments IPNs using HMAC-SHA512 over recursively key-sorted JSON and signs customer settlement callbacks with per-installation HMAC-SHA256.

## Reuse for another enterprise customer

For another managed MkLMS customer:

1. choose a unique installation ID, e.g. `customer-acme`;
2. generate a unique `MKLMS_BILLING_SHARED_SECRET` on that installation;
3. add one entry to `MKETY_BILLING_CUSTOMERS_JSON` with its settlement/success/cancel URLs and matching shared secret;
4. set that installation's `MKLMS_BILLING_SERVICE_URL` to the same central billing Worker;
5. keep the same central NOWPayments API/IPN credentials unless a business decision requires a separate merchant account.

This lets one billing Worker serve multiple managed installations without storing their database passwords.

## Future MKSaaS integration

MKSaaS should consume this billing Worker as a reusable payment-provider/settlement service rather than copying the legacy NOWPayments route. The customer registry may later move from a secret JSON object to MKSaaS tenant storage without changing already-deployed MkLMS settlement endpoints.
