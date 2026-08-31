# Managed hosting operator note

This file is for repository operators/agents maintaining managed deployments. Do not surface this policy configuration in customer-facing setup documentation or tenant-editable settings.

The managed-hosting notice is deployment-owned and read only to the tenant admin. The runtime policy is supplied through host environment configuration. The UI displays only the current month's measured/estimated usage, calculated amount, optional notice, and one safe external payment link.

Rules:
- hard minimum fee is USD 15
- default maximum is USD 50 unless the deployment owner intentionally changes the private environment policy
- the month is UTC calendar month; the first day of a new month naturally produces fresh usage totals while preserving old history
- payment destination is one HTTP(S) link, not a stored wallet/network field
- tenant admins cannot mutate the policy through the application
- measured and estimated usage must remain visibly distinguished
