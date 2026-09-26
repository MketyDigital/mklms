# Shared Flutterwave checkout contract

Mkety Media keeps all product and invoice pricing in USD. The shared MkSaaS Flutterwave service is responsible for quoting and launching the customer-facing Flutterwave checkout in the requested payment currency.

## Start checkout

Media calls the configured `FLUTTERWAVE_CHECKOUT_BROKER_URL` with an internal bearer secret and requests the Inline experience.

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
  "media_webhook_url": "https://media.mkety.com/api/billing/flutterwave/webhook",
  "checkout_experience": "inline"
}
```

Successful Inline response:

```json
{
  "checkout_experience": "inline",
  "checkout_amount": 65000,
  "checkout_currency": "NGN",
  "inline": {
    "publicKey": "FLWPUBK_...",
    "reference": "MKM-XXXXXXXXXX",
    "amount": 65000,
    "currency": "NGN",
    "email": "customer@example.com",
    "redirectPath": "/billing?payment=processing&provider=flutterwave",
    "metadata": {},
    "payloadHash": "..."
  }
}
```

The Flutterwave Standard secret key never leaves MkSaaS. If Inline is unavailable, Media may consume the existing hosted-checkout fallback returned by the broker.

For non-USD checkout, the broker performs the currency quote. Media does not maintain FX rates. Media stores the returned amount/currency on the invoice and later verifies the settled Flutterwave charge against that stored quote.

## Webhook routing

The Flutterwave dashboard webhook for the shared Mkety Standard/v3 integration is:

`https://mkety.com/api/payments/flutterwave/webhook`

For Media events, the central service forwards the original raw body unchanged to:

`https://media.mkety.com/api/billing/flutterwave/webhook`

For Flutterwave Standard/v3 events, MkSaaS validates `verif-hash`, re-queries the transaction with `FLUTTERWAVE_STANDARD_SECRET_KEY`, and verifies status/reference/currency/amount. Only after that succeeds does it forward the unchanged original body and original `verif-hash` to Media, together with:

`x-mkety-payment-attestation: <base64 HMAC-SHA256 of the unchanged raw body using FLUTTERWAVE_CHECKOUT_BROKER_SECRET>`

Media validates that internal attestation before settlement. This keeps the Standard secret key centralized on MkSaaS; Media does not need it.

Media retains compatibility code for direct Flutterwave v4 events when v4 credentials are intentionally configured. That path is separate from the shared MkSaaS Standard/v3 Inline flow.

## Supported Media currency choices

USD, NGN, GHS, KES, GBP, EUR, ZAR, XAF, XOF, UGX, RWF, TZS, MWK, EGP.

Actual payment methods remain subject to the Flutterwave merchant account, currency, country, and method enablement.
