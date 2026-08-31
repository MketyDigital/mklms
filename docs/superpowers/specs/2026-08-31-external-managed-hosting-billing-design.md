# External Managed Hosting Billing Design

**Date:** 2026-08-31
**Status:** Approved

## Goal

Add automatic monthly managed-hosting settlement without replacing MkLMS's existing `PENDING | PAID | WAIVED` model or manual operator controls. Use a reusable Cloudflare Worker that can serve this installation, future enterprise MkLMS customers, and the later MKSaaS upgrade.

## Boundaries

- Existing manual monthly editor remains unchanged and authoritative as a fallback.
- Existing usage calculation and monthly amount calculation remain in MkLMS.
- Existing student/admin authentication is unchanged.
- Payment automation only adds a second trusted way to mark an existing month `PAID`.
- NOWPayments credentials use the same environment variable names already used by legacy `MketyDigital/Mkety`: `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET`.

## Architecture

```text
MkLMS Hosting & Usage
  -> POST /api/managed-hosting/checkout
  -> signed request to reusable Billing Worker
  -> NOWPayments invoice
  -> customer pays
  -> NOWPayments IPN -> Billing Worker
  -> strict HMAC-SHA512 verification
  -> signed settlement request to MkLMS
  -> managed_hosting_months.payment_status = PAID
```

The billing Worker is stateless for the initial release. Its per-installation registry is supplied as a secret JSON environment variable. Idempotency is provided by the settlement operation: replaying the same successful payment can only upsert the same month to `PAID`.

## Billing Worker configuration

Required secrets:

- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`
- `MKETY_BILLING_CUSTOMERS_JSON`

`MKETY_BILLING_CUSTOMERS_JSON` is a JSON object keyed by installation ID. Each entry contains:

```json
{
  "spf-mklms": {
    "settlementUrl": "https://customer.example/api/managed-hosting/settlement",
    "sharedSecret": "long-random-secret",
    "successUrl": "https://customer.example/admin/hosting?payment=success",
    "cancelUrl": "https://customer.example/admin/hosting?payment=cancelled"
  }
}
```

No customer database passwords are stored in the central Worker.

## MkLMS configuration

Optional automation variables:

- `MKLMS_BILLING_SERVICE_URL`
- `MKLMS_BILLING_INSTALLATION_ID`
- `MKLMS_BILLING_SHARED_SECRET`

The existing `MKLMS_MANAGED_PAYMENT_URL` remains supported as a manual/fallback payment link.

## Checkout request contract

MkLMS sends installation ID, month key, exact amount due, timestamp and a nonce to the billing Worker. It signs the canonical payload with `MKLMS_BILLING_SHARED_SECRET` using HMAC-SHA256. The Worker rejects missing, stale, malformed or invalid requests before calling NOWPayments.

The Worker creates a NOWPayments invoice using the same legacy API endpoint and environment variable as the existing Mkety production repository. The order ID encodes the installation and month in a validated, reversible form.

## IPN security

The new Worker improves on the legacy route by failing closed:

- missing `NOWPAYMENTS_IPN_SECRET` -> server configuration error;
- missing `x-nowpayments-sig` -> reject;
- invalid HMAC-SHA512 -> reject;
- malformed payload/order ID -> reject;
- unknown installation -> reject.

Automatic settlement occurs only for `finished`. `confirmed` and `sending` are not sufficient because the funds may not yet have reached the merchant wallet. `partially_paid` does not automatically mark a month paid.

## Settlement contract

The billing Worker sends installation ID, month key, payment ID, paid amount/currency, NOWPayments status and timestamp to the customer's settlement endpoint. It signs the canonical body with that customer's shared secret using HMAC-SHA256.

MkLMS verifies the signature and timestamp, validates the month/payment fields, then updates the existing `managed_hosting_months` record to `PAID`. It does not alter usage, minimum floor, operator note or manual `WAIVED` capability except that an actual successful payment may move the target month to `PAID`.

## Manual controls

The existing admin editor remains available at Admin -> Hosting & Usage whenever `MKLMS_MANAGED_HOSTING_ENABLED=true`. It requires a valid admin session plus `MKLMS_MANAGED_HOSTING_OPERATOR_KEY` and can set `PENDING`, `PAID`, or `WAIVED`.

## Reuse in MKSaaS

The Billing Worker is intentionally independent of MkLMS data models. MKSaaS should reuse the Worker/provider contract instead of copying NOWPayments logic. MKSaaS can later register tenant settlement callbacks in the same customer registry or replace the registry with durable storage without changing existing MkLMS customers.

## Non-goals

- no recurring fixed NOWPayments subscription;
- no replacement of current MkLMS monthly billing calculations;
- no removal of manual operator controls;
- no customer DB credentials in the Worker;
- no new external auth provider;
- no card gateway in this release.

## Verification

Require tests for request signatures, strict IPN verification, order parsing, `finished`-only automatic settlement, settlement signatures, replay/idempotent behavior, and preservation of manual statuses. Require lint, Next.js build, OpenNext build and Wrangler dry-run for the billing Worker before merge.
