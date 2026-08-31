# Managed-hosting policy boundary

Managed-hosting billing is an operator-owned deployment feature, not a tenant-editable LMS setting.

- Tenant admins may see current-month usage, the resulting managed-service amount, an optional operator-defined notice, and one external **Pay now** button.
- Tenant admins cannot edit the billing policy in MkLMS.
- The deployment owner configures the payment destination only through `MKLMS_MANAGED_PAYMENT_URL=https://...` in deployment environment variables.
- `MKLMS_MANAGED_PAYMENT_URL` must be a safe HTTP(S) URL and may be documented in `.env.example`; no payment secret is stored there.
- No wallet address, USDT network, crypto address, or tenant-editable payment destination belongs in MkLMS.
- The hard minimum service fee is USD 15; the deployment owner may set a higher maximum, with USD 50 as the default maximum.
- Current-month usage is derived by UTC calendar month. New months automatically start with fresh totals without deleting historical evidence.
- Course watch evidence is measured from trusted playback progress. Baseline live audience-minutes are estimates and remain labelled as such.
