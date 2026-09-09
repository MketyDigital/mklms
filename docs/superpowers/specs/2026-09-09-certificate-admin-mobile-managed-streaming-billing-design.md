# Certificate Placement, Admin Mobile, and Managed Streaming Billing Design

**Date:** 2026-09-09
**Status:** Approved

## Goal
Fix certificate placement, add admin certificate viewing, make the full admin area mobile friendly, and evolve managed hosting into a usage-sensitive managed video hosting/streaming bill controlled only by Mkety.

## Safety constraints
- Do not remove or rename existing production routes, data, Cloudflare resources, installation manifests, auth gates, or tenant isolation.
- Do not touch production branches until implementation and tests are green.
- Existing certificate issuance remains idempotent unless admin explicitly reissues.
- Customer-visible measured usage remains real measured usage.
- Where exact telemetry is incomplete, show explicitly labelled estimated activity derived from real signals. Never present a reverse-engineered billing number as measured watch minutes.
- Internal pricing floors, caps, weights, operator adjustments, and formulas remain Mkety-only and are not shown on customer admin pages.

## A. Certificate placement

### A1. Visual normalized placement
New templates use normalized, template-relative field placement:

```ts
interface CertificateFieldPlacement {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  fontSize: number;
  align: "left" | "center" | "right";
}

interface CertificateVisualLayout {
  version: 2;
  name: CertificateFieldPlacement;
  completionDate: CertificateFieldPlacement;
  certificateId: CertificateFieldPlacement;
}
```

The browser editor uses top-left coordinates. The PDF renderer converts them to the PDF coordinate system using actual page dimensions. Existing raw `nameX/nameY/dateX/dateY/idX/idY` layouts remain readable.

### A2. Drag-and-drop editor
`Admin -> Certificate Templates` renders the uploaded PDF/PNG/JPEG artwork with draggable/touchable boxes for Student Name, Completion Date, and Certificate ID. Admin can set alignment/font size, preview realistic sample values, and save normalized coordinates. Raw coordinates move behind an advanced/debug control.

### A3. Starpips calibration
The current Starpips template must be calibrated so the student name sits on the blank recipient line, the completion date sits in the dedicated DATE OF COMPLETION area, and the certificate ID remains readable. Long names shrink within safe bounds instead of overflowing. Calibration is stored as template data, never hard-coded globally.

### A4. Admin issued-certificate access
`Admin -> Certificates` lists every installation-scoped issued certificate with student, course, certificate ID, issue/completion date, status, View certificate, Download PDF, and existing revoke/reissue/message actions. Admin view/download endpoints require admin auth and tenant-scoped lookup.

## B. Full admin mobile responsiveness
- Admin shell uses mobile header + drawer/sheet navigation on small screens and preserves desktop sidebar on large screens.
- No admin route or navigation item is removed.
- All admin pages under `src/app/(admin)/admin/**` are audited.
- Forms collapse to one column; dense tables scroll safely or use responsive cards; dialogs/sheets fit viewport; long IDs/emails/URLs wrap; actions remain usable.
- Certificate placement editor supports touch and responsive preview scaling without changing normalized coordinates.
- Desktop behavior remains functionally equivalent.

## C. Managed video hosting & streaming billing

### C1. Customer product model
Enterprise admins experience this as a managed video hosting/streaming service bill. They see current hosting balance/amount due, billing period, real or explicitly estimated usage, payment date/status, and history. They do not see `monthly minimum`, `minimum floor`, `maximum`, `daily baseline`, `multiplier`, `automatic increase`, `operator adjustment`, or other internal pricing mechanics.

### C2. Usage evidence and weighting
Billing influence order:
1. measured course video watch minutes;
2. measured protected playback/video views;
3. measured unique viewers where available;
4. measured live audience minutes;
5. explicitly estimated streaming/audience activity derived from real signals when exact telemetry is incomplete;
6. ordinary authenticated portal visits at low weight.

Normal page visits never carry equal billing weight to video streaming.

### C3. Estimated activity
Estimated activity is allowed and should be useful when exact provider telemetry is unavailable. It must:
- be derived from real signals such as playback grants, session counts, view starts, course progress, live attendance, and portal visits;
- use a documented deterministic model/version;
- be labelled `Estimated streaming activity` or `Estimated audience usage`, not `measured watch minutes`;
- never overwrite or falsify measured watch-minute records;
- be auditable from the inputs that produced the estimate.

### C4. Usage-sensitive daily accrual
Internal daily service accrual is:

```text
required baseline progression toward configured service floor
+ weighted streaming/video usage uplift
+ low-weight portal-traffic uplift
+ authorized Mkety operator adjustment
```

The configured floor remains private and ensures the month reaches at least the configured service price. Real/estimated streaming activity can increase the balance faster, bounded by configured policy. Manual daily adjustments do not permanently alter the automatic algorithm unless policy itself is changed.

### C5. Daily billing ledger
Add installation-scoped daily ledger records containing billing date/month, measured watch minutes, measured playback views, unique viewers when available, live audience usage, estimated streaming activity and its evidence inputs, portal visits, automatic baseline accrual, usage uplift, operator adjustment, daily contribution, resulting monthly balance, calculation version, timestamps, and operator/audit reference.

Pricing and usage are separate facts: historical usage is never rewritten to match price.

### C6. Payment window
Checkout opens only:
- day 30 for every non-February month;
- February 28 in common years / February 29 in leap years.

Generic rule:
```ts
paymentOpenDay = month === February ? lastDayOfMonth : 30;
```
Before that date, show the accumulating balance and payment availability date but do not allow checkout. Enforce this in both UI and server-side checkout API.

### C7. Mkety-only billing control plane
Every installation keeps customer-facing Hosting & Usage, but pricing authority exists only in trusted Mkety operator production/control plane. Customer admins cannot modify floor/cap, weights, calculation version, operator adjustments, enforcement/grace settings, or other installations.

Mkety operator view provides installation list, balances, usage summaries, daily/monthly ledger, manual adjustment with reason, internal pricing policy, payment/waiver controls as authorized, and audit history. Authorization is server-side; hiding controls is not security.

### C8. Manual daily adjustment
An authorized Mkety operator can add/subtract a one-day adjustment with a required reason. The next automatic calculation continues from the new accumulated balance and remaining days. The one-day adjustment does not repeat automatically.

## D. Verification and release gates
- Add failing tests before production code for certificate placement, billing window, estimated activity, ledger idempotency, operator authorization, and responsive contract behavior.
- Run targeted tests, full test suite, lint, production build, OpenNext/Worker dry-run checks already required by repo release gates.
- Verify Starpips certificate output against the supplied artwork/issued examples.
- Verify customer admin does not expose internal pricing terms or mutation controls.
- Verify Mkety operator mutations are rejected outside trusted operator context.
- Verify checkout rejects early payment server-side.
- Release only after green CI and deliberate production branch promotion.
