export interface ImportedLiveChatItem {
  offsetSeconds: number;
  displayName: string;
  message: string;
}

export interface LiveChatImportError {
  line: number;
  message: string;
}

export interface LiveChatImportResult {
  items: ImportedLiveChatItem[];
  errors: LiveChatImportError[];
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  cells.push(value.trim());
  return cells;
}

function normalizeItem(
  offsetRaw: string,
  displayNameRaw: string,
  messageRaw: string,
): ImportedLiveChatItem | null {
  const offsetSeconds = Number(offsetRaw);
  const displayName = displayNameRaw.trim();
  const message = messageRaw.trim();
  if (!Number.isFinite(offsetSeconds) || offsetSeconds < 0 || !displayName || !message) {
    return null;
  }
  return {
    offsetSeconds: Math.floor(offsetSeconds),
    displayName,
    message,
  };
}

export function parseLiveChatCsv(input: string): LiveChatImportResult {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/);
  const result: LiveChatImportResult = { items: [], errors: [] };
  if (!lines.length || !lines[0]?.trim()) return result;

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const offsetIndex = headers.indexOf("offset_seconds");
  const nameIndex = headers.indexOf("display_name");
  const messageIndex = headers.indexOf("message");
  if (offsetIndex < 0 || nameIndex < 0 || messageIndex < 0) {
    return {
      items: [],
      errors: [{ line: 1, message: "CSV requires offset_seconds, display_name and message columns." }],
    };
  }

  lines.slice(1).forEach((line, index) => {
    if (!line.trim()) return;
    const cells = parseCsvLine(line);
    const item = normalizeItem(
      cells[offsetIndex] ?? "",
      cells[nameIndex] ?? "",
      cells[messageIndex] ?? "",
    );
    if (item) result.items.push(item);
    else result.errors.push({ line: index + 2, message: "Invalid chat row." });
  });

  return result;
}

function timestampToSeconds(hours: string, minutes: string, seconds: string): number {
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function parseTimestampedLiveChat(input: string): LiveChatImportResult {
  const result: LiveChatImportResult = { items: [], errors: [] };
  input.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    const match = line.match(/^(\d{1,2}):(\d{2}):(\d{2})\s+(.+?)\s*:\s*(.+)$/);
    if (!match) {
      result.errors.push({ line: index + 1, message: "Expected HH:MM:SS Name: message." });
      return;
    }

    const [, hours, minutes, seconds, rawName, rawMessage] = match;
    const numericMinutes = Number(minutes);
    const numericSeconds = Number(seconds);
    if (numericMinutes > 59 || numericSeconds > 59) {
      result.errors.push({ line: index + 1, message: "Invalid timestamp." });
      return;
    }

    const zoomNameMatch = rawName.match(/^From\s+(.+?)\s+to\s+Everyone\s*$/i);
    const displayName = (zoomNameMatch?.[1] ?? rawName).trim();
    const message = rawMessage.trim();
    if (!displayName || !message) {
      result.errors.push({ line: index + 1, message: "Missing display name or message." });
      return;
    }

    result.items.push({
      offsetSeconds: timestampToSeconds(hours, minutes, seconds),
      displayName,
      message,
    });
  });
  return result;
}
