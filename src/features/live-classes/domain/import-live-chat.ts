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

interface PendingZoomMessage {
  line: number;
  offsetSeconds: number;
  displayName: string;
  messageLines: string[];
}

function flushPendingZoomMessage(
  result: LiveChatImportResult,
  pending: PendingZoomMessage | null,
): void {
  if (!pending) return;
  const message = pending.messageLines.join("\n").trim();
  if (!message) {
    result.errors.push({ line: pending.line, message: "Missing chat message." });
    return;
  }
  result.items.push({
    offsetSeconds: pending.offsetSeconds,
    displayName: pending.displayName,
    message,
  });
}

function rebaseWallClockZoomTimestamps(
  result: LiveChatImportResult,
  input: string,
): LiveChatImportResult {
  if (result.items.length === 0) return result;

  const hasZoomEveryoneWrapper = /From\s+.+?\s+to\s+Everyone\s*:/i.test(input);
  if (!hasZoomEveryoneWrapper) return result;

  // Sessions are capped at 12 hours. A first Zoom timestamp at or beyond that
  // cannot be a valid in-video offset, so treat it as a wall-clock time and
  // rebase the export to the first chat message. Relative Zoom exports such as
  // 00:00:30 remain untouched.
  const firstOffset = result.items[0]?.offsetSeconds ?? 0;
  if (firstOffset < 12 * 60 * 60) return result;

  return {
    ...result,
    items: result.items.map((item) => ({
      ...item,
      offsetSeconds: item.offsetSeconds >= firstOffset
        ? item.offsetSeconds - firstOffset
        : item.offsetSeconds + 24 * 60 * 60 - firstOffset,
    })),
  };
}

export function parseTimestampedLiveChat(input: string): LiveChatImportResult {
  const result: LiveChatImportResult = { items: [], errors: [] };
  const normalizedInput = input.replace(/^\uFEFF/, "");
  const lines = normalizedInput.split(/\r?\n/);
  let pending: PendingZoomMessage | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    if (!line) continue;

    const timestampMatch = line.match(/^(\d{1,2}):(\d{2}):(\d{2})\s+(.+)$/);
    if (!timestampMatch) {
      if (pending) {
        pending.messageLines.push(line);
      } else {
        result.errors.push({ line: index + 1, message: "Expected HH:MM:SS Name: message." });
      }
      continue;
    }

    flushPendingZoomMessage(result, pending);
    pending = null;

    const [, hours, minutes, seconds, remainderRaw] = timestampMatch;
    const numericMinutes = Number(minutes);
    const numericSeconds = Number(seconds);
    if (numericMinutes > 59 || numericSeconds > 59) {
      result.errors.push({ line: index + 1, message: "Invalid timestamp." });
      continue;
    }

    const offsetSeconds = timestampToSeconds(hours, minutes, seconds);
    const remainder = remainderRaw.trim();
    const zoomMatch = remainder.match(/^From\s+(.+?)\s+to\s+Everyone\s*:\s*(.*)$/i);
    if (zoomMatch) {
      const displayName = zoomMatch[1].trim();
      const message = zoomMatch[2].trim();
      if (!displayName) {
        result.errors.push({ line: index + 1, message: "Missing display name or message." });
        continue;
      }
      if (message) {
        result.items.push({ offsetSeconds, displayName, message });
      } else {
        pending = {
          line: index + 1,
          offsetSeconds,
          displayName,
          messageLines: [],
        };
      }
      continue;
    }

    const genericMatch = remainder.match(/^(.+?)\s*:\s*(.+)$/);
    if (!genericMatch) {
      result.errors.push({ line: index + 1, message: "Expected HH:MM:SS Name: message." });
      continue;
    }

    const displayName = genericMatch[1].trim();
    const message = genericMatch[2].trim();
    if (!displayName || !message) {
      result.errors.push({ line: index + 1, message: "Missing display name or message." });
      continue;
    }

    result.items.push({ offsetSeconds, displayName, message });
  }

  flushPendingZoomMessage(result, pending);
  return rebaseWallClockZoomTimestamps(result, normalizedInput);
}
