# Mkety Media operator guide

## Operator login

Production operator URL:

`https://media.mkety.com/operator/login`

The password field expects the secret stored as `MEDIA_OPERATOR_ACCESS_KEY` (or the configured Mkety admin fallback secret). It is not a customer password and must only be shared with trusted Mkety operators.

The operator session is HttpOnly, signed and time-limited.

## First things to review in /operator

1. Integrations — NOWPayments and Telegram should show configured.
2. Portal content — public signup, hero copy and plan benefits.
3. Billing terms — 3/6/12-month discounts.
4. Local bank transfer — enable and configure if desired.
5. Enforcement — payment grace/suspension policy.
6. Public plans — public prices and capacity.
7. Extra capacity packs — prepaid add-ons.
8. Storage pools — internal only; never expose provider names publicly.
9. Enterprise requests — negotiate and provision custom customers.
10. Custom-domain requests — provision/refresh branded hostnames.
11. Pending payments — web fallback for manual approvals.
12. Customers — custom price/limits/Enterprise capabilities.

## Enable manual bank transfer

In `/operator` -> **Local bank transfer**:

- tick **Enable bank transfer**;
- set local currency (for example NGN);
- set current USD-to-local conversion rate;
- set rounding amount;
- enter bank name;
- enter account name;
- enter account number;
- add transfer instructions;
- click **Save bank details**.

After saving, pending invoices show **Pay by bank transfer**.

When the customer chooses it:
- the exact local amount is locked on the invoice;
- changing the operator FX rate later does not alter that invoice;
- customer sees the bank details;
- customer can submit proof through the Telegram bot;
- operator must verify actual bank credit before approving.

## Automatic payment

NOWPayments is automatic. A customer selects automatic payment and is redirected to the hosted invoice. Only a valid signed finished-payment callback settles the Mkety invoice.

## Changing plan before first payment

A newly registered customer is not locked into the first selection. On Billing they can choose **Choose a different plan or billing term**. Mkety cancels the old unpaid invoice and creates a new one while keeping the same account/username.

After activation, normal plan increases use the paid upgrade flow.

## Telegram

Public command menu:
- `/start`
- `/pay`

Hidden operator commands still work for authorized staff:
- `/whoami`
- `/bindgroup`
- `/groupid`

Customer messages are relayed to the private operator group. Reply to the relayed message to answer that exact customer.

## Custom domains

Custom domains are intended for custom/Enterprise customers.

Customer:
1. opens Custom domains;
2. requests `media.customer.com`.

Operator:
1. reviews request in `/operator`;
2. clicks **Provision hostname**;
3. customer creates the shown CNAME/TXT record if required;
4. operator clicks **Refresh DNS/TLS status**;
5. once active, Mkety maps the hostname to that tenant.

Customer URL format:
`https://media.customer.com/bucket-name/file.jpg`

## Library export

Every customer can open **Export Library** from the dashboard and download:
- JSON manifest;
- CSV manifest;
- macOS/Linux download-all script;
- Windows PowerShell download-all script.

This gives customers a practical exit/migration path without operator approval.
