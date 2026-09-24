# Customer experience

## Before payment
1. Visitor sees simple public pricing with all included benefits.
2. Visitor chooses Monthly, 3, 6 or 12 months.
3. Visitor creates a username + password. Email is not required for v1.
4. Account remains pending until payment succeeds.

## Payment
Automated:
- NOWPayments invoice -> verified IPN -> activate subscription.

Manual/local:
- portal shows transfer instructions + unique invoice reference;
- Mkety operator receives Telegram approval message;
- operator taps Approve after independently confirming receipt;
- account activates automatically.

## Subsequent login
Customer signs in with username + password. A secure HttpOnly session cookie is issued.
No magic links, email dependency, Supabase Auth or Zitadel is required.

## Dashboard
Dashboard must show at a glance:
- current plan/custom offer;
- amount and renewal date;
- storage used / limit;
- delivery used / limit;
- request count / limit;
- buckets used / limit;
- prepaid balance if applicable;
- warnings at 70/85/95%;
- payment status.

## Files
The default workflow is deliberately simple:
1. Buckets -> New Bucket.
2. Open bucket.
3. Upload or drag files.
4. File appears with thumbnail/preview.
5. Copy URL.
6. Optional rename/move/delete.

Public customer copy never mentions R2, OCI, AWS, GCP, Azure, Wasabi, Backblaze or DigitalOcean. Everything is branded Mkety Media.

## Enterprise/custom contracts
Enterprise is a capability flag, not a forced large quota.

An operator may set any exact combination:
- $3/mo with Starter limits;
- $99/mo with Starter limits but dedicated storage/SLA;
- 10 GB or 10 TB;
- 1 bucket or 1,000 buckets;
- shared or dedicated infrastructure;
- custom billing term.

The customer still gets the same simple self-service portal.
