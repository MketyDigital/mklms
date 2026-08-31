# Managed-hosting policy boundary

Managed-hosting billing is an operator-owned deployment feature, not a tenant-editable LMS setting.

- Tenant admins may see current-month usage, the resulting managed-service amount, an optional operator-defined notice, and one external payment button.
- Tenant admins cannot edit the billing policy in MkLMS.
- Billing policy configuration is deployment-owned and must not be exposed in normal customer setup guides or `.env.example`.
- The hard minimum service fee is USD 15; the deployment owner may set a higher maximum, with USD 50 as the default maximum.
- Current-month usage is derived by UTC calendar month. New months automatically start with fresh totals without deleting historical evidence.
- Course watch evidence is measured from trusted playback progress. Baseline live audience-minutes are estimates and remain labelled as such.
- Payment destinations are safe HTTP(S) links only; no wallet/network fields are stored in the application database.
