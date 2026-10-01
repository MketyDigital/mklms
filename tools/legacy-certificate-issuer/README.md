# Starpips Legacy Certificate Issuer

Standalone certificate automation for students who graduated before MkLMS.

**Start here:** [HANDOFF.md](./HANDOFF.md)

That file contains:

- what has already been completed;
- Google Drive asset IDs;
- exact remaining steps;
- first test procedure;
- expected statuses;
- troubleshooting;
- launch checklist;
- rules for keeping this separate from MkLMS.

## Core design

```text
Google Form
    ↓
Approved Graduates
    ↓
Google Apps Script
    ↓
Starpips Google Slides template
    ↓
PDF
    ↓
MailApp
    ↓
Issued Certificates log
```

There is intentionally **no certificate number** for this legacy flow.

## Files

- `Code.gs` — full Apps Script implementation
- `HANDOFF.md` — current operational source of truth / continuation guide
- `appsscript.json` — optional Apps Script manifest reference
- `../../certs/cert.png` — real Starpips certificate artwork

This utility does not alter MkLMS students, enrollments, courses, certificate records, database migrations, or Starpips production deployment.
