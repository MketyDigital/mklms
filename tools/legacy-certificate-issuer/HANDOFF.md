# START HERE — Starpips Legacy Certificate Issuer

This is the handoff document for the standalone old-student certificate workflow.

## Goal

Issue Starpips certificates to students who graduated before MkLMS existed, without creating them inside MkLMS.

The workflow is intentionally separate from the live LMS.

```text
Old student
   ↓
Google Form
   ↓
Approved Graduates check
   ↓
Generate Starpips certificate PDF
   ↓
Email automatically
   ↓
Log result in Google Sheet
```

There is intentionally **no certificate number** on these legacy certificates.

---

# What is already done

## GitHub

Branch:

```text
feature/legacy-certificate-issuer
```

Pull request:

```text
#89 — Add standalone Starpips legacy certificate issuer
```

Main implementation:

```text
tools/legacy-certificate-issuer/Code.gs
```

Supporting files:

```text
tools/legacy-certificate-issuer/README.md
tools/legacy-certificate-issuer/appsscript.json
```

Real Starpips certificate artwork:

```text
certs/cert.png
```

Nothing in this branch deploys or changes Starpips production.

## Google Drive

A private Drive folder has already been created:

**Starpips Legacy Certificate Issuer**

Folder ID:

```text
1PIDOmK5el-lpNOIp-P7-R2vB4pWfvOCF
```

Inside it:

### Certificate template

Title:

```text
Starpips Legacy Certificate Template
```

Google Slides ID:

```text
1NmdftAs05jhrfhnTNlaqBDozTyHN-PjjzosBKgqyuFA
```

Status:

- changed to Standard 4:3
- real Starpips `certs/cert.png` artwork inserted
- `{{NAME}}` placeholder inserted
- `{{DATE}}` placeholder inserted
- certificate number intentionally omitted

The template is already prepared. **Do not run `setupCertificateTemplate()` unless the template gets deleted or needs to be rebuilt.**

### Certificate register

Title:

```text
Starpips Legacy Certificate Register
```

Google Sheet ID:

```text
1DC-13zG9vZWu9fef2PRyxWXwxS6WbTHLuTPwfF4SBAs
```

Tabs already prepared:

#### Approved Graduates

Columns:

```text
Email | Full Name | Graduation Date | Notes
```

#### Issued Certificates

Columns:

```text
Email
Full Name
Graduation Date
PDF File ID
PDF File URL
Status
First Sent At
Last Sent At
Last Error
```

The Sheet timezone is already set to:

```text
Africa/Lagos
```

The exact Slides and Sheet IDs are already hard-coded in `Code.gs`.

---

# What the user has already done

The user already:

1. connected Google Drive to ChatGPT;
2. created/opened a Google Apps Script project;
3. copied the contents of `Code.gs` into that project;
4. saved it;
5. changed the Slides template to Standard 4:3.

That means the next step is **not** to copy any more GitHub files.

Only `Code.gs` is required for the simple Apps Script setup.

---

# NEXT STEP — do this now

Open the Google Apps Script project where `Code.gs` was pasted.

At the top toolbar there is a function selector/dropdown.

Choose:

```text
setupLegacyCertificateIssuer
```

Then click:

```text
Run
```

## First-run Google permissions

Google will ask for authorization.

Follow the Google prompts:

1. Review permissions
2. choose the Google account that should own/run the certificate automation
3. allow the requested permissions

The script needs access to Google Forms, Sheets, Slides, Drive and Mail so it can create the form, generate PDFs and send certificate emails.

## Expected result

After `setupLegacyCertificateIssuer()` finishes, open the Apps Script Execution log.

It should print:

```text
Setup complete.
Form edit URL: ...
Form public URL: ...
Spreadsheet URL: ...
```

Save the **Form public URL**.

That is the link old students will eventually use.

---

# What setupLegacyCertificateIssuer() creates

The function automatically:

1. opens the already-prepared Starpips Legacy Certificate Register;
2. creates a Google Form titled:
   `Starpips Certificate Request – Previous Students`;
3. asks:
   - Full Name
   - Email Address
   - Graduation Date
4. connects Form responses to the prepared Google Sheet;
5. creates an installed form-submit trigger;
6. stores the required project properties.

The user does not need to manually create the Google Form or trigger.

---

# Before testing

No approval list is required.

Use your own email address for the first test submission so you can confirm the full flow safely.

The student enters:

- Full Name
- Email Address
- Graduation Date

---

# First end-to-end test

After setup is complete:

1. open the Form public URL;
2. enter your own email address;
3. enter a test name;
4. enter a graduation date;
5. submit.

Expected automation:

```text
Form submitted
   ↓
Email normalized
   ↓
Approved Graduates checked
   ↓
Existing certificate checked
   ↓
Slides template copied temporarily
   ↓
{{NAME}} replaced
{{DATE}} replaced
   ↓
PDF exported
   ↓
PDF saved to Google Drive
   ↓
PDF emailed using MailApp
   ↓
Issued Certificates row added with SENT
   ↓
temporary Slides copy trashed
```

Check:

1. the inbox of the submitted email;
2. the generated PDF;
3. the `Issued Certificates` tab.

The row should show:

```text
Status = SENT
```

---

# Verify the certificate visually

Check that:

- Starpips certificate artwork is correct;
- graduate name is centered in the recipient area;
- graduation date is in the date area;
- there is no certificate number;
- no `{{NAME}}` or `{{DATE}}` placeholders remain in the final PDF;
- PDF is landscape and not stretched.

The placement is based on the existing Starpips MkLMS calibration:

```text
Name:
x 18%
y 60%
width 64%
28 pt
centered

Date:
x 8%
y 81%
width 25%
11 pt
centered
```

---

# Approval behavior

Current configuration:

```js
APPROVAL_MODE: "OFF"
```

Therefore there is **no manual or pre-approved student check**.

Anyone with the Google Form link can submit:

- Full Name
- Email Address
- Graduation Date

After a valid submission, the certificate is generated and emailed automatically.

The `Approved Graduates` tab may remain in the spreadsheet for future use, but it is currently **not used** by the live legacy certificate flow.

If tighter control is ever needed later, change `APPROVAL_MODE` back to `"EMAIL"` and load approved emails into the `Approved Graduates` tab.

---

# Duplicate behavior

If an approved email has already successfully received a certificate and submits again:

- a new certificate is **not** generated;
- the existing PDF is resent;
- the existing log row becomes:
  `RESENT`;
- `Last Sent At` is updated.

This prevents duplicate certificate generation.

---

# Email behavior

No SMTP configuration is required.

The script uses:

```text
MailApp.sendEmail()
```

Email is sent by the Google account that authorized the Apps Script project.

Current subject:

```text
Your Starpips Certificate
```

Current body:

```text
Congratulations [Name]. Your Starpips certificate is attached to this email.

Please keep this PDF safely for your records.

Starpips Forex Academy
```

The PDF is attached directly.

---

# Important operating rule

Do not merge this workflow into MkLMS student/enrollment/course logic.

Legacy certificate issuance is intentionally isolated.

It does not create:

- MkLMS students
- MkLMS enrollments
- MkLMS completed courses
- MkLMS certificate database records

As a result, these legacy certificates currently do **not** appear in the MkLMS public certificate verifier.

That can be added later as a separate legacy verification register if desired.

---

# What NOT to do

Do not:

- add certificate numbers unless the requirement changes;
- deploy this branch to `production/starpips`;
- create legacy students in MkLMS just to issue certificates;
- configure SMTP;
- expose the certificate template publicly;
- remove the Approved Graduates check before launch;
- merge PR #89 merely to make Apps Script work — Apps Script works independently once pasted.

---

# If the setup function fails

## Error: permission / authorization

Run `setupLegacyCertificateIssuer` again and complete Google's permission flow.

## Error: prepared sheets missing

Confirm the Google Sheet contains tabs named exactly:

```text
Approved Graduates
Issued Certificates
```

## Error: presentation/template access

Confirm the Google account running Apps Script has access to:

```text
1NmdftAs05jhrfhnTNlaqBDozTyHN-PjjzosBKgqyuFA
```

## Error: spreadsheet access

Confirm it has access to:

```text
1DC-13zG9vZWu9fef2PRyxWXwxS6WbTHLuTPwfF4SBAs
```

## Form works but no email arrives

Check:

1. Apps Script → Executions
2. `Issued Certificates` → Last Error
3. spam/junk folder
4. Google account daily Apps Script email quota

---

# Launch checklist

Do not distribute the Form until all boxes are checked.

- [ ] `setupLegacyCertificateIssuer()` ran successfully
- [ ] Form public URL was obtained
- [ ] test submission completed
- [ ] email arrived
- [ ] PDF opened successfully
- [ ] name placement correct
- [ ] date placement correct
- [ ] no certificate number visible
- [ ] Issued Certificates shows SENT
- [ ] second submission resends rather than creating duplicate
- [ ] form wording reviewed

Once these checks pass, distribute the Form public URL to old Starpips graduates.

---

# Useful source files

```text
certs/cert.png
tools/legacy-certificate-issuer/Code.gs
tools/legacy-certificate-issuer/README.md
tools/legacy-certificate-issuer/HANDOFF.md
tools/legacy-certificate-issuer/appsscript.json
```

The practical source of truth for continuing this project is:

```text
tools/legacy-certificate-issuer/HANDOFF.md
```

