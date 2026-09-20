# Starpips Legacy Certificate Issuer

A deliberately separate certificate workflow for students who graduated before MkLMS.

It does **not** create MkLMS students, enrollments, courses, or certificate records. It uses Google Forms, Sheets, Slides, Drive, and Apps Script only.

## Result

```text
Old student submits Google Form
        ↓
Apps Script validates the email against Approved Graduates
        ↓
Checks whether a certificate was already issued
        ↓
Copies the Starpips certificate template
        ↓
Replaces {{NAME}} and {{DATE}}
        ↓
Exports PDF
        ↓
Emails PDF automatically with MailApp
        ↓
Logs SENT / RESENT / REVIEW REQUIRED
```

There is intentionally **no certificate number** in this legacy workflow.

## Certificate artwork

The source artwork is the repository file:

```text
certs/cert.png
```

The setup helper fetches that exact file from the repository.

The existing Starpips MkLMS calibration is reused for the two fields we need:

- recipient name: x 18%, y 60%, width 64%, 28 pt, centered
- graduation date: x 8%, y 81%, width 25%, 11 pt, centered

The MkLMS certificate-ID placement is intentionally omitted.

## One-time setup

### 1. Create the certificate Slides file

Create a new blank Google Slides presentation.

Choose:

```text
File → Page setup → Standard (4:3)
```

The Starpips artwork is 1131 × 849, effectively 4:3.

Copy the presentation ID from its URL:

```text
https://docs.google.com/presentation/d/PRESENTATION_ID/edit
```

### 2. Create a standalone Apps Script project

Open Google Apps Script and create a new project.

Copy `Code.gs` from this folder into the project.

Replace:

```js
TEMPLATE_PRESENTATION_ID: "PASTE_4_BY_3_GOOGLE_SLIDES_ID_HERE",
```

with the ID from step 1.

### 3. Prepare the certificate template

Run:

```text
setupCertificateTemplate
```

Approve Google's permissions when prompted.

This will:

- pull `certs/cert.png` from GitHub;
- clear the first slide;
- fill the whole 4:3 page with the real Starpips artwork;
- place `{{NAME}}` and `{{DATE}}` at the Starpips-calibrated positions.

You can visually inspect the slide after this step.

### 4. Build the Form + Sheet + trigger

Run:

```text
setupLegacyCertificateIssuer
```

The execution log will show:

- Form edit URL
- Form public URL
- Spreadsheet URL

The Form asks only for:

1. Full Name
2. Email Address
3. Graduation Date

The script creates two administrative sheets:

#### Approved Graduates

```text
Email | Full Name | Graduation Date | Notes
```

Add old students here before sharing the Form.

Only the Email column is required for automatic approval in the default configuration.

#### Issued Certificates

The script maintains this automatically. It records PDF file ID/link, send status, first-send time, last-send time, and errors.

## Duplicate handling

If the same approved email submits again after a certificate was successfully issued, the script does **not** create a second certificate.

It resends the existing PDF and marks the row `RESENT`.

## Approval behavior

Default:

```js
APPROVAL_MODE: "EMAIL"
```

This means only emails listed in `Approved Graduates` receive a certificate.

An unrecognized email is logged as:

```text
REVIEW REQUIRED
```

and no certificate is sent.

For a fully open form, change the value to:

```js
APPROVAL_MODE: "OFF"
```

That is not recommended for an official certificate link.

## Email delivery

No SMTP configuration is required.

`MailApp.sendEmail()` sends from the Google account that owns/authorized the Apps Script project.

The generated PDF is also stored in that Google account's Drive so it can be resent without generating a second copy.

## Safety / operational notes

- Test with your own email before sharing the public Form.
- Keep the Apps Script project and issuer spreadsheet private to authorized Starpips staff.
- Do not publish the template Slides file publicly.
- Google applies daily Apps Script email quotas. For normal self-service legacy claims this is usually fine; bulk re-issuance should be paced accordingly.
- This tool intentionally does not write to the MkLMS production database or deploy anything to Starpips production.
