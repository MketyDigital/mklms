# Production Course, Media, Quiz, Paid Live, Certificate, and Billing Design

## Goal

Repair the production media upload path, make paid Courses fully editable, add first-class quizzes and paid-course live sessions, prove certificate rendering with the repository certificate template, and make managed-hosting billing accrue dynamically through the month without exposing billing controls to tenant admins.

## Non-negotiable product boundaries

1. The existing public/free Live Classes feature under `/live/[slug]` remains a standalone free webinar/live-class system.
2. Paid-course live sessions are a separate authenticated course feature. They require an authenticated student and active course enrollment.
3. No paid-course live change may alter the public/free live state, playback, chat, scheduling, viewer-count, or public URL behavior.
4. Existing protected course playback, existing R2 objects, existing media records, existing enrollments, progress, messages, access flows, and certificate records must remain compatible.
5. Tenant admins must not be able to edit managed-hosting minimums, maximums, the billing formula, or operator overrides.
6. Historical migrations must not be edited. The current repository contains migrations through `012`; new schema work begins at `013`.

## 1. Direct R2 media upload

### Problem

The current admin media upload posts the whole MP4 to the main application route, calls `request.formData()`, reads `file.arrayBuffer()`, and only then writes the bytes through the configured storage provider. This places large video bodies and memory pressure on the application Worker and is not a true browser-to-R2 upload.

### Design

Use a direct-to-R2 upload handshake for Cloudflare production while keeping the existing provider-neutral registration model.

- Admin asks the server to initiate an upload.
- Server validates admin session, title, content type, file size, and requested metadata.
- Server generates a server-owned object key under `media/`; browser never chooses the bucket or arbitrary prefix.
- For Cloudflare/R2 S3-compatible direct upload, server returns short-lived presigned upload authorization using deployment-owned R2 S3 credentials that are never returned to the browser.
- Browser uploads the file directly to the authorized object key.
- Browser calls a finalize endpoint with the upload token/object key and media metadata.
- Finalize verifies the object exists and registers the existing `DIRECT` media record with `providerAssetId` equal to the private object key.
- If a direct-upload credential set is unavailable, the UI must fail clearly rather than silently routing large files through the application Worker.
- Existing R2 browser/register-existing-object functionality remains available.

Production bucket ownership stays deployment-side. The current Cloudflare application binding points to `spf-media`, and direct-upload S3 credentials must be scoped to the intended R2 bucket.

## 2. Full course editing

The Courses admin must support editing all course-owned learning content without destructive replacement.

### Course fields

- title
- description
- publication status
- slug only where collision-safe and not destructive to existing links

### Module fields

- title
- description
- ordering

### Lesson fields

- title
- description
- media asset
- completion method
- completion threshold
- duration
- publication status
- ordering

The UI should use real forms/select controls rather than browser `prompt()` dialogs for normal editing.

Existing progress-protection rules for destructive deletes remain in force.

## 3. First-class quizzes

Add quizzes as course learning activities rather than treating them as generic `CUSTOM` completion.

### Data model

A quiz belongs to a course module and has ordered questions. A question has ordered answer choices and one or more correct choices according to question type. Initial production scope is single-answer multiple choice.

Quiz configuration includes:

- title
- instructions/description
- pass mark percentage
- publication status
- position within the module learning sequence

Attempt data includes:

- student
- quiz
- started/completed timestamps
- score percentage
- pass/fail
- selected answers

### Student behavior

- only enrolled authenticated students can take a paid-course quiz;
- unpublished quizzes are not available to students;
- attempts are scored server-side;
- passing a quiz marks that learning activity complete;
- quiz completion participates in course progress and certificate eligibility;
- the server, not browser-supplied correctness flags, determines score.

## 4. Paid-course live sessions

Paid live is a new course-owned subsystem and must not reuse the public/free `/live/[slug]` access contract.

### Data model

A paid course live session belongs to a course and includes:

- title
- optional description
- media asset
- scheduled start
- scheduled end
- status/publication state

### Admin behavior

From Course Builder, admins can create, edit, publish/unpublish, and delete paid live sessions subject to history/progress protection where needed.

### Student authorization

A paid-live student route/API requires:

1. authenticated student session;
2. active/completed enrollment in the owning course;
3. published/available course;
4. published paid-live session;
5. server-resolved live time window;
6. READY protected media asset.

Only then is a short-lived protected playback URL issued. The media-delivery worker and signed private MP4 contract can be reused, but the authorization endpoint and database records are paid-course specific.

### Separation guarantee

No changes to paid live may change:

- `/live/[slug]` public availability;
- free live chat/timeline behavior;
- free live viewer mode/count behavior;
- free live scheduling/state rules;
- free live playback endpoint contract.

Regression tests must explicitly assert this boundary.

## 5. Certificate production proof with `certs/cert.png`

The repository contains the real certificate template at `certs/cert.png`.

Add a production-like certificate preview/test path that uses the same `PdfLibCertificateRenderer` used by issuance and renders:

- student name;
- completion date;
- certificate ID.

The test must use `certs/cert.png`, produce a real PDF, and validate that a PDF is generated with non-empty bytes. Layout coordinates for the real template should be centralized as a named default layout so preview and issuance use the same values.

The existing certificate-template upload/storage and issuance flow stays compatible. The repository template is a test/default asset, not a reason to make R2 public.

## 6. Dynamic managed-hosting billing display

### Required billing behavior

The configured monthly minimum is a month-end floor, not an amount that should be displayed in full on day 1.

For a month with `D` days and current day `d`, the accrued minimum is:

`configuredMinimum * d / D`

rounded to cents. The displayed/due amount is:

`max(accruedMinimum, usageDerivedFee, operatorMonthlyFloorIfHigher)`

At the end of the month the accrued minimum equals the configured monthly minimum. If usage is higher, the usage-derived amount wins. If the deployment/operator increases the configured minimum, accrual uses that configured value. If an operator-specific monthly floor is higher, that higher floor remains authoritative.

The checkout endpoint and admin display must calculate the amount from the same server-side function so the displayed value cannot diverge from checkout.

### Admin access boundary

Tenant/admin users may view the amount and payment state, but must not edit:

- `MKLMS_MANAGED_HOSTING_MIN_USD`;
- `MKLMS_MANAGED_HOSTING_MAX_USD`;
- billing formula;
- deployment operator overrides.

## 7. Migration and compatibility strategy

Create additive migration `013` for quizzes and paid-course live session tables/columns. Do not modify migrations `001` through `012`.

Prefer additive nullable/defaulted fields where compatibility is required. Existing courses with only modules/lessons remain valid.

## 8. Test strategy

Use TDD for each behavior change.

Required regression coverage includes:

- media upload initiation never accepts a client-selected bucket/key prefix;
- upload finalization registers only an expected private `media/...` object;
- existing object registration remains valid;
- course/module/lesson editing persists all supported fields;
- quiz score is server-derived and passing completion contributes to course progress;
- paid live rejects unauthenticated and unenrolled students;
- paid live authorizes enrolled students only inside its live window;
- the existing free `/live/[slug]` public contract remains unchanged;
- `certs/cert.png` renders to a non-empty PDF with the real renderer;
- billing is below the full monthly minimum early in the month, reaches the minimum at month end, rises above it for higher usage, and respects a higher operator floor;
- tenant admin routes/components expose no billing-policy mutation controls.

## 9. Deployment safety

All changes land on an isolated feature branch and go through domain tests, lint, Next.js production build, OpenNext build, main Worker packaging, media-delivery Worker packaging, billing Worker packaging, and CodeQL before merge. `main` remains untouched until explicit review/merge.