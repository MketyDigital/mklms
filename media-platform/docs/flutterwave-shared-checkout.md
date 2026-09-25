# Shared Flutterwave checkout contract

Mkety Media keeps all product and invoice pricing in USD. The shared MkSaaS Flutterwave service is responsible for quoting and launching the customer-facing Flutterwave checkout in the requested payment currency.

## Start checkout

Media calls the configured `FLUTTERWAVE_CHECKOUT_BROKER_URL` with an internal bearer secret.

Request:

```json
{
  "source": "media",
  "reference": "MKM-XXXXXXXXXX",
  "canonical_amount_usd": 39.99,
  "requested_payment_currency": "NGN",
  "email": "customer@example.com",
  "customer_name": "Customer business",
  "invoice_id": "media-invoice-id",
  "tenant_id": "media-tenant-id",
  "redirect_url": "https://media.mkety.com/billing?payment=processing&provider=flutterwave",
  "media_webhook_url": "https://media.mkety.com/api/billing/flutterwave/webhook"
}
```

Successful response:

```json
{
  "checkout_url": "https://...",
  "checkout_amount": 65000,
  "checkout_currency": "NGN"
}
```

The aliases `url`, `amount`, and `currency` are also accepted.

For non-USD checkout, the broker must perform the currency quote. Media does not maintain FX rates. Media stores the returned amount/currency on the invoice and later verifies the settled Flutterwave charge against that exact quote.

## Webhook routing

Flutterwave's dashboard can use one central webhook, for example:

`https://mkety.com/api/payments/flutterwave/webhook`

For Media events, the central service should forward the original raw body unchanged to:

`https://media.mkety.com/api/billing/flutterwave/webhook`

and preserve the original `flutterwave-signature` header. Media independently verifies the signature and then re-fetches the charge from Flutterwave v4 before settlement.

## Supported Media currency choices

USD, NGN, GHS, KES, GBP, EUR, ZAR, XAF, XOF, UGX, RWF, TZS.

Actual payment methods remain subject to the Flutterwave merchant account, currency, country and method enablement.
