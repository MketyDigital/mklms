import { normalizeIdentity } from "./preauthorization.ts";

export interface PreauthorizationImportRow {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  courseId?: string | null;
}

export interface PreauthorizationImportError {
  line: number;
  code: "INVALID_IDENTITY" | "DUPLICATE_IDENTITY" | "MISSING_IDENTITY";
  message: string;
}

export interface PreauthorizationImportResult {
  rows: PreauthorizationImportRow[];
  errors: PreauthorizationImportError[];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeRow(row: PreauthorizationImportRow): PreauthorizationImportRow {
  const email = row.email?.trim()
    ? normalizeIdentity(row.email, "email")
    : null;
  const phone = row.phone?.trim()
    ? normalizeIdentity(row.phone, "phone")
    : null;

  return {
    name: row.name?.trim() || null,
    email,
    phone,
    courseId: row.courseId?.trim() || null,
  };
}

function identityKeys(row: PreauthorizationImportRow): string[] {
  const keys: string[] = [];
  if (row.email) keys.push(`email:${row.email}`);
  if (row.phone) keys.push(`phone:${row.phone}`);
  return keys;
}

function isValidRow(row: PreauthorizationImportRow): boolean {
  const validEmail = row.email ? EMAIL_PATTERN.test(row.email) : false;
  const validPhone = row.phone ? /^\d{7,20}$/.test(row.phone) : false;
  return validEmail || validPhone;
}

function addRow(
  result: PreauthorizationImportResult,
  seen: Set<string>,
  row: PreauthorizationImportRow,
  line: number,
): void {
  const normalized = normalizeRow(row);
  const keys = identityKeys(normalized);

  if (keys.length === 0) {
    result.errors.push({
      line,
      code: "MISSING_IDENTITY",
      message: "Provide at least an email address or phone number.",
    });
    return;
  }

  if (!isValidRow(normalized)) {
    result.errors.push({
      line,
      code: "INVALID_IDENTITY",
      message: "The email address or phone number is not valid.",
    });
    return;
  }

  if (keys.some((key) => seen.has(key))) {
    result.errors.push({
      line,
      code: "DUPLICATE_IDENTITY",
      message: "This student identity already exists in the import.",
    });
    return;
  }

  keys.forEach((key) => seen.add(key));
  result.rows.push(normalized);
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }

  fields.push(field);
  return fields;
}

function normalizedHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function headerIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

export function parsePreauthorizationCsv(
  input: string,
): PreauthorizationImportResult {
  const result: PreauthorizationImportResult = { rows: [], errors: [] };
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return result;

  const headers = splitCsvLine(lines[0]).map(normalizedHeader);
  const indexes = {
    name: headerIndex(headers, ["name", "full name", "fullname", "your name", "student name"]),
    email: headerIndex(headers, ["email", "email address", "e mail", "e mail address"]),
    phone: headerIndex(headers, [
      "phone", "phone number", "phonenumber", "mobile", "mobile number", "telephone", "telephone number", "whatsapp", "whatsapp number",
    ]),
    courseId: headerIndex(headers, ["courseid", "course id", "course", "course name"]),
  };
  const seen = new Set<string>();

  for (let index = 1; index < lines.length; index += 1) {
    const fields = splitCsvLine(lines[index]);
    const valueAt = (fieldIndex: number) =>
      fieldIndex >= 0 ? fields[fieldIndex] ?? "" : "";

    addRow(
      result,
      seen,
      {
        name: valueAt(indexes.name),
        email: valueAt(indexes.email),
        phone: valueAt(indexes.phone),
        courseId: valueAt(indexes.courseId),
      },
      index + 1,
    );
  }

  return result;
}

export function parsePreauthorizationPaste(
  input: string,
): PreauthorizationImportResult {
  const result: PreauthorizationImportResult = { rows: [], errors: [] };
  const seen = new Set<string>();
  const lines = input.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const value = rawLine.trim();
    if (!value) return;

    const looksLikeEmail = value.includes("@");
    const normalizedPhone = normalizeIdentity(value, "phone");
    const looksLikePhone = /^\+?[\d\s().-]{7,}$/.test(value) && normalizedPhone.length >= 7;

    if (!looksLikeEmail && !looksLikePhone) {
      result.errors.push({
        line: index + 1,
        code: "INVALID_IDENTITY",
        message: "Enter one email address or phone number per line.",
      });
      return;
    }

    addRow(
      result,
      seen,
      looksLikeEmail ? { email: value } : { phone: value },
      index + 1,
    );
  });

  return result;
}
