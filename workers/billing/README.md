# Mkety managed-hosting billing Worker

This standalone Cloudflare Worker creates NOWPayments invoices for managed MkLMS installations and converts a verified final NOWPayments IPN into a signed settlement callback.

It is deliberately independent of any one customer's database. Customer installations are identified by an installation ID and authenticated with a unique shared secret.

## Routes

- `POST /v1/invoices` — accepts a signed, fresh MkLMS request containing installation ID, month, server-calculated USD amount and nonce; creates a NOWPayments invoice.
- `POST /webhooks/nowpayments` — validates `x-nowpayments-sig` and settles only a `finished` payment.

## Secrets

Set these on the Worker:

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
MKETY_BILLING_CUSTOMERS_JSON
```

The first two names intentionally match the existing legacy Mkety production application. The same existing secret values can be configured here; no new NOWPayments merchant credentials are required.

Do not commit any of these values.

## Customer registry

```json
{
  "spf-mklms": {
    "settlementUrl": "https://CUSTOMER_HOST/api/managed-hosting/settlement",
    "sharedSecret": "LONG_UNIQUE_CUSTOMER_SECRET",
    "successUrl": "https://CUSTOMER_HOST/admin/hosting?payment=success",
    "cancelUrl": "https://CUSTOMER_HOST/admin/hosting?payment=cancelled"
  }
}
```

Every installation gets its own `sharedSecret`. The Worker never receives that customer's PostgreSQL password.

## Deploy

```bash
npx wrangler secret put NOWPAYMENTS_API_KEY --config workers/billing/wrangler.jsonc
npx wrangler secret put NOWPAYMENTS_IPN_SECRET --config workers/billing/wrangler.jsonc
npx wrangler secret put MKETY_BILLING_CUSTOMERS_JSON --config workers/billing/wrangler.jsonc
npx wrangler deploy --config workers/billing/wrangler.jsonc
```

Then configure the customer MkLMS app with:

```text
MKLMS_BILLING_SERVICE_URL=https://<deployed-worker>.workers.dev/
MKLMS_BILLING_INSTALLATION_ID=spf-mklms
MKLMS_BILLING_SHARED_SECRET=<same per-customer sharedSecret in registry>
```

## Manual fallback

The billing Worker does not replace `MKLMS_MANAGED_PAYMENT_URL` or the Admin -> Hosting & Usage manual editor. If automation is not configured, MkLMS keeps using the existing payment-link path. Operators can still manually set `PENDING`, `PAID`, or `WAIVED` using `MKLMS_MANAGED_HOSTING_OPERATOR_KEY`.

## Security

- invoice requests must be HMAC-SHA256 signed and no more than five minutes old;
- NOWPayments IPN signature is mandatory and verified using HMAC-SHA512 over recursively sorted JSON;
- only `finished` triggers settlement;
- customer callbacks are HMAC-SHA256 signed with that customer's shared secret;
- settlement replay is safe because the target operation idempotently marks the same month `PAID`.
