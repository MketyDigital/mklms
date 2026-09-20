/**
 * Starpips Legacy Certificate Issuer
 *
 * Standalone Google Apps Script for pre-MkLMS graduates.
 * Keeps legacy certificate issuance separate from MkLMS.
 *
 * CURRENT STATE (2026-09-20):
 * - Google Slides certificate template already exists, is 4:3, and is prepared.
 * - Google Sheet register already exists with Approved Graduates and
 *   Issued Certificates tabs.
 * - Both exact Google file IDs are hard-coded below.
 * - Certificate numbers are intentionally omitted.
 *
 * NEXT STEP:
 * Run setupLegacyCertificateIssuer() ONCE in the user's Apps Script project.
 * It creates the Google Form, connects it to the prepared Sheet, and installs
 * the form-submit trigger.
 *
 * Do NOT run setupCertificateTemplate() during normal continuation; it is only
 * a rebuild helper if the prepared Slides template is lost or intentionally reset.
 *
 * No SMTP setup is needed. MailApp sends from the Google account that authorizes
 * this Apps Script project.
 *
 * Full continuation instructions: HANDOFF.md in this folder.
 */

const CONFIG = {
  TEMPLATE_PRESENTATION_ID: "1NmdftAs05jhrfhnTNlaqBDozTyHN-PjjzosBKgqyuFA",
  SPREADSHEET_ID: "1DC-13zG9vZWu9fef2PRyxWXwxS6WbTHLuTPwfF4SBAs",
  CERT_ARTWORK_URL:
    "https://raw.githubusercontent.com/MketyDigital/mklms/main/certs/cert.png",

  FORM_TITLE: "Starpips Certificate Request – Previous Students",
  FORM_DESCRIPTION:
    "For previous Starpips students who completed their training before the current learning system. Enter your details exactly as they should appear on your certificate.",

  RESPONSES_SHEET_NAME: "Form Responses 1",
  APPROVED_SHEET_NAME: "Approved Graduates",
  ISSUED_SHEET_NAME: "Issued Certificates",

  // EMAIL = only emails in Approved Graduates may receive certificates.
  // OFF = every valid submission may receive a certificate.
  APPROVAL_MODE: "EMAIL",

  EMAIL_SUBJECT: "Your Starpips Certificate",
  EMAIL_BODY:
    "Congratulations. Your Starpips certificate is attached to this email.\n\nPlease keep this PDF safely for your records.\n\nStarpips Forex Academy",

  TIME_ZONE: "Africa/Lagos",
  DATE_FORMAT: "d MMMM yyyy",

  // Existing Starpips visual calibration, with certificate ID intentionally omitted.
  NAME: {
    xRatio: 0.18,
    yRatio: 0.60,
    widthRatio: 0.64,
    heightRatio: 0.10,
    fontSize: 28,
  },
  DATE: {
    xRatio: 0.08,
    yRatio: 0.81,
    widthRatio: 0.25,
    heightRatio: 0.06,
    fontSize: 11,
  },
};

function setupCertificateTemplate() {
  assertTemplateConfigured_();

  const presentation = SlidesApp.openById(CONFIG.TEMPLATE_PRESENTATION_ID);
  const pageWidth = presentation.getPageWidth();
  const pageHeight = presentation.getPageHeight();

  // 4:3 guard. The source artwork is 1131 x 849, effectively 4:3.
  const ratio = pageWidth / pageHeight;
  if (Math.abs(ratio - 4 / 3) > 0.02) {
    throw new Error(
      "The certificate Slides file must use Standard (4:3) page setup. In Google Slides choose File > Page setup > Standard (4:3), then run this function again.",
    );
  }

  let slides = presentation.getSlides();
  if (slides.length === 0) {
    presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    slides = presentation.getSlides();
  }

  const slide = slides[0];
  for (let i = slides.length - 1; i >= 1; i--) {
    slides[i].remove();
  }

  slide.getPageElements().forEach((element) => element.remove());

  const response = UrlFetchApp.fetch(CONFIG.CERT_ARTWORK_URL, {
    muteHttpExceptions: false,
    followRedirects: true,
  });
  const artwork = response.getBlob().setName("starpips-certificate-artwork.jpg");

  slide.insertImage(artwork, 0, 0, pageWidth, pageHeight);

  insertPlaceholder_(slide, "{{NAME}}", CONFIG.NAME, pageWidth, pageHeight, true);
  insertPlaceholder_(slide, "{{DATE}}", CONFIG.DATE, pageWidth, pageHeight, false);

  presentation.saveAndClose();
  Logger.log("Certificate template prepared successfully.");
}

function setupLegacyCertificateIssuer() {
  assertTemplateConfigured_();

  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const spreadsheetId = spreadsheet.getId();

  const approved = spreadsheet.getSheetByName(CONFIG.APPROVED_SHEET_NAME);
  const issued = spreadsheet.getSheetByName(CONFIG.ISSUED_SHEET_NAME);
  if (!approved || !issued) {
    throw new Error(
      "The prepared Approved Graduates and Issued Certificates sheets are missing.",
    );
  }

  const form = FormApp.create(CONFIG.FORM_TITLE);
  form.setDescription(CONFIG.FORM_DESCRIPTION);
  form.setConfirmationMessage(
    "Thank you. If your details match our graduate records, your certificate will be sent to the email address you provided.",
  );

  form.addTextItem().setTitle("Full Name").setRequired(true);
  form.addTextItem().setTitle("Email Address").setRequired(true);
  form.addDateItem().setTitle("Graduation Date").setRequired(true);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheetId);

  // Remove any duplicate trigger for this handler before installing a fresh one.
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "onLegacyCertificateFormSubmit")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("onLegacyCertificateFormSubmit")
    .forSpreadsheet(spreadsheet)
    .onFormSubmit()
    .create();

  PropertiesService.getScriptProperties().setProperties({
    LEGACY_CERT_SPREADSHEET_ID: spreadsheetId,
    LEGACY_CERT_FORM_ID: form.getId(),
  });

  Logger.log("Setup complete.");
  Logger.log("Form edit URL: " + form.getEditUrl());
  Logger.log("Form public URL: " + form.getPublishedUrl());
  Logger.log("Spreadsheet URL: " + spreadsheet.getUrl());
}

function onLegacyCertificateFormSubmit(e) {
  if (!e || !e.range) {
    throw new Error("This function must run from the installed spreadsheet form-submit trigger.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const responseSheet = e.range.getSheet();
    const row = e.range.getRow();
    const data = readSubmissionRow_(responseSheet, row);

    const fullName = cleanName_(data["Full Name"]);
    const email = normalizeEmail_(data["Email Address"]);
    const graduationDate = formatGraduationDate_(data["Graduation Date"]);

    if (!fullName) throw new Error("Full Name is required.");
    if (!isValidEmail_(email)) throw new Error("A valid email address is required.");
    if (!graduationDate) throw new Error("A valid Graduation Date is required.");

    const spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
    const issuedSheet = spreadsheet.getSheetByName(CONFIG.ISSUED_SHEET_NAME);
    const approvedSheet = spreadsheet.getSheetByName(CONFIG.APPROVED_SHEET_NAME);

    if (!issuedSheet || !approvedSheet) {
      throw new Error("Required issuer sheets are missing.");
    }

    if (CONFIG.APPROVAL_MODE === "EMAIL" && !isApprovedEmail_(approvedSheet, email)) {
      appendIssueLog_(issuedSheet, {
        email,
        fullName,
        graduationDate,
        status: "REVIEW REQUIRED",
        error: "Email not found in Approved Graduates.",
      });
      return;
    }

    const existing = findIssuedByEmail_(issuedSheet, email);
    if (existing && existing.pdfFileId) {
      resendExisting_(issuedSheet, existing, email, fullName);
      return;
    }

    const result = generateCertificatePdf_({
      fullName,
      graduationDate,
    });

    sendCertificateEmail_(email, fullName, result.pdfBlob);

    const now = new Date();
    appendIssueLog_(issuedSheet, {
      email,
      fullName,
      graduationDate,
      pdfFileId: result.pdfFileId,
      pdfFileUrl: result.pdfFileUrl,
      status: "SENT",
      firstSentAt: now,
      lastSentAt: now,
      error: "",
    });
  } catch (error) {
    try {
      const spreadsheet = SpreadsheetApp.openById(getSpreadsheetId_());
      const issuedSheet = spreadsheet.getSheetByName(CONFIG.ISSUED_SHEET_NAME);
      if (issuedSheet) {
        appendIssueLog_(issuedSheet, {
          email: "",
          fullName: "",
          graduationDate: "",
          status: "FAILED",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (_) {
      // Preserve the original error.
    }
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function generateCertificatePdf_(input) {
  assertTemplateConfigured_();

  const templateFile = DriveApp.getFileById(CONFIG.TEMPLATE_PRESENTATION_ID);
  const tempCopy = templateFile.makeCopy(
    "TEMP Starpips Certificate - " + sanitizeFilename_(input.fullName),
  );

  try {
    const presentation = SlidesApp.openById(tempCopy.getId());
    presentation.replaceAllText("{{NAME}}", input.fullName);
    presentation.replaceAllText("{{DATE}}", input.graduationDate);
    presentation.saveAndClose();

    Utilities.sleep(500);

    const pdfName =
      "Starpips Certificate - " + sanitizeFilename_(input.fullName) + ".pdf";
    const pdfBlob = DriveApp.getFileById(tempCopy.getId())
      .getAs(MimeType.PDF)
      .setName(pdfName);

    const pdfFile = DriveApp.createFile(pdfBlob);

    return {
      pdfBlob: pdfBlob,
      pdfFileId: pdfFile.getId(),
      pdfFileUrl: pdfFile.getUrl(),
    };
  } finally {
    tempCopy.setTrashed(true);
  }
}

function sendCertificateEmail_(email, fullName, pdfBlob) {
  MailApp.sendEmail({
    to: email,
    subject: CONFIG.EMAIL_SUBJECT,
    body: CONFIG.EMAIL_BODY.replace("Congratulations.", "Congratulations " + fullName + "."),
    attachments: [pdfBlob],
    name: "Starpips Forex Academy",
  });
}

function resendExisting_(issuedSheet, existing, email, fullName) {
  const file = DriveApp.getFileById(existing.pdfFileId);
  const blob = file.getBlob().setName(file.getName());
  sendCertificateEmail_(email, fullName, blob);

  issuedSheet.getRange(existing.row, 6).setValue("RESENT");
  issuedSheet.getRange(existing.row, 8).setValue(new Date());
  issuedSheet.getRange(existing.row, 9).clearContent();
}

function isApprovedEmail_(sheet, email) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const emails = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getDisplayValues()
    .flat()
    .map(normalizeEmail_);

  return emails.includes(email);
}

function findIssuedByEmail_(sheet, email) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  for (let index = 0; index < values.length; index++) {
    const row = values[index];
    const status = String(row[5] || "").trim().toUpperCase();
    if (
      normalizeEmail_(row[0]) === email &&
      (status === "SENT" || status === "RESENT") &&
      String(row[3] || "").trim()
    ) {
      return {
        row: index + 2,
        pdfFileId: String(row[3]).trim(),
      };
    }
  }

  return null;
}

function appendIssueLog_(sheet, data) {
  sheet.appendRow([
    data.email || "",
    data.fullName || "",
    data.graduationDate || "",
    data.pdfFileId || "",
    data.pdfFileUrl || "",
    data.status || "",
    data.firstSentAt || "",
    data.lastSentAt || "",
    data.error || "",
  ]);
}

function readSubmissionRow_(sheet, row) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const rawValues = sheet.getRange(row, 1, 1, lastColumn).getValues()[0];

  return headers.reduce((record, header, index) => {
    record[String(header).trim()] = rawValues[index];
    return record;
  }, {});
}

function formatGraduationDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, CONFIG.TIME_ZONE, CONFIG.DATE_FORMAT);
  }

  const text = String(value || "").trim();
  if (!text) return "";

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, CONFIG.TIME_ZONE, CONFIG.DATE_FORMAT);
  }

  return text;
}

function insertPlaceholder_(slide, text, field, pageWidth, pageHeight, bold) {
  const x = field.xRatio * pageWidth;
  const y = field.yRatio * pageHeight;
  const width = field.widthRatio * pageWidth;
  const height = field.heightRatio * pageHeight;

  const shape = slide.insertTextBox(text, x, y, width, height);
  shape.getFill().setTransparent();
  shape.getLine().setTransparent();

  const textRange = shape.getText();
  textRange
    .getTextStyle()
    .setFontFamily("Arial")
    .setFontSize(field.fontSize)
    .setBold(Boolean(bold))
    .setForegroundColor("#141414");

  textRange.getParagraphStyle().setParagraphAlignment(
    SlidesApp.ParagraphAlignment.CENTER,
  );

  shape.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
}

function cleanName_(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeEmail_(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeFilename_(value) {
  return String(value || "Graduate")
    .replace(/[\\/:*?"<>|]+/g, "")
    .trim()
    .slice(0, 100) || "Graduate";
}

function getSpreadsheetId_() {
  return CONFIG.SPREADSHEET_ID;
}

function assertTemplateConfigured_() {
  if (!CONFIG.TEMPLATE_PRESENTATION_ID || !CONFIG.SPREADSHEET_ID) {
    throw new Error(
      "Set CONFIG.TEMPLATE_PRESENTATION_ID to your 4:3 Google Slides certificate template first.",
    );
  }
}
