# Mkety Media commercial model

## Public positioning
Mkety Media is sold as a simple managed media/file storage and delivery service. Public/customer UI must not mention Cloudflare R2, OCI, AWS, GCS, Azure, Backblaze, Wasabi or DigitalOcean.

Customers see Mkety Media storage, Mkety cached delivery links, their purchased limits, team seats, billing term and usage counters.

## Customer types

### Self-service customer
- Signs up without Mkety staff.
- Selects a public plan and 1/3/6/12-month term.
- Creates username/password before payment.
- Service activates only after verified payment.
- Creates logical buckets, uploads files, previews/copies links and deletes files.
- Can add team members within plan limits.
- Uses Mkety Global storage placement (R2 internally).
- Cannot select or see an underlying provider.

### Enterprise-capability customer
Uses the same simple portal and may receive any operator-defined combination: exact custom price, exact custom quotas, Starter-sized or larger limits, custom term, regional placement, dedicated infrastructure, and additional seats/buckets.

Enterprise is a capability flag, not a minimum size. Example: Starpips may use a private $3/month launch offer with Starter limits while still having Enterprise capabilities.

Only Enterprise-capability tenants may be pinned to a non-default storage pool.

## Launch public plans
Defaults, fully editable by Mkety operator:
- Starter — $5/month — 10 GB storage, 100 GB delivery, 1M delivery requests, 3 buckets, 1 seat.
- Growth — $15/month — 50 GB storage, 500 GB delivery, 5M requests, 10 buckets, 3 seats.
- Business — $39/month — 200 GB storage, 2 TB delivery, 20M requests, 50 buckets, 10 seats.
- Enterprise — $99/month — 500 GB storage, 5 TB delivery, 50M requests, 250 buckets, 25 seats.

V1 maximum single object is capped at 5 GB until multipart upload is implemented.

## Billing terms
Default discounts, editable from Operator:
- Monthly: 0%
- 3 months: 3%
- 6 months: 5%
- 12 months: 8%

Keep discounts deliberately small to protect margin.

## Billing safety
Launch policy is prepaid fixed subscription + hard caps. Never allow unbounded post-paid cloud usage.

1. New account is pending until payment settles.
2. Upload signing checks storage quota before issuing a direct-upload URL.
3. Upload quota is reserved before the browser sends bytes.
4. Finalization verifies the object exists and its actual size matches the reservation.
5. Storage, delivery and request limits are visible to the customer.
6. At 100% of a purchased limit, additional usage is blocked.
7. No customer balance may silently become negative.
8. Higher quotas require plan upgrade or operator-approved prepaid/custom offer first.
9. If renewal expires, new uploads/mutations are blocked immediately.
10. Existing public delivery may remain during the operator-configured grace period, then is blocked if unpaid.

## Manual/local payment
No receipt upload is required. The portal locks the local-currency amount and displays bank instructions. The Telegram bot sends the Mkety operator Approve/Reject buttons. The operator verifies the bank credit independently, then approval activates or renews the account. The web Operator console is a fallback if Telegram is unavailable.

## Automated payment
NOWPayments uses the existing NOWPAYMENTS_API_KEY and NOWPAYMENTS_IPN_SECRET secret names. Only a verified finished IPN settles service, and payment IDs are idempotent.

## Margin principle
Mkety sells the managed product, not raw provider pricing. Price covers storage, cached delivery, dashboard, isolation, payment automation, usage enforcement, team access, multi-provider capability and operations/support. Review real provider costs before increasing quotas or enabling non-R2 pools.
