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

interface PendingTimestamp {
  line: number;
  offsetSeconds: number;
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

function parseMessageHeader(value: string): { displayName: string; message: string } | null {
  const remainder = value.trim();
  if (!remainder) return null;

  // Modern Zoom exports can target Everyone, Hosts and panelists, a host,
  // or another visible recipient. The recipient does not affect staged-chat
  // display; only the sender and message are retained.
  const zoomRecipientMatch = remainder.match(/^From\s+(.+?)\s+to\s+.+?\s*:\s*(.*)$/i);
  if (zoomRecipientMatch) {
    return {
      displayName: zoomRecipientMatch[1].trim(),
      message: zoomRecipientMatch[2].trim(),
    };
  }

  // Older Zoom meeting_saved_chat files can omit the recipient entirely.
  const oldZoomMatch = remainder.match(/^From\s+(.+?)\s*:\s*(.*)$/i);
  if (oldZoomMatch) {
    return {
      displayName: oldZoomMatch[1].trim(),
      message: oldZoomMatch[2].trim(),
    };
  }

  const genericMatch = remainder.match(/^(.+?)\s*:\s*(.*)$/);
  if (!genericMatch) return null;
  return {
    displayName: genericMatch[1].trim(),
    message: genericMatch[2].trim(),
  };
}

export function looksLikeZoomChatExport(input: string): boolean {
  return /(?:^|\n)\s*(?:\d{1,2}:\d{2}:\d{2}\s+)?From\s+.+?(?:\s+to\s+.+?)?\s*:/im.test(input);
}

function rebaseWallClockZoomTimestamps(
  result: LiveChatImportResult,
  input: string,
): LiveChatImportResult {
  if (result.items.length === 0 || !looksLikeZoomChatExport(input)) return result;

  // Sessions are capped at 12 hours. A first Zoom timestamp at or beyond that
  // cannot be a valid in-video offset, so treat it as a wall-clock time and
  // rebase the export to the first chat message. Session-aware calibration in
  // AdminLiveClassService handles morning wall-clock exports and explicit
  // operator placement when the first chat did not occur at video second 0.
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
  let pendingMessage: PendingZoomMessage | null = null;
  let pendingTimestamp: PendingTimestamp | null = null;

  const startMessage = (
    line: number,
    offsetSeconds: number,
    header: { displayName: string; message: string },
  ) => {
    if (!header.displayName) {
      result.errors.push({ line, message: "Missing display name." });
      return;
    }
    flushPendingZoomMessage(result, pendingMessage);
    pendingMessage = {
      line,
      offsetSeconds,
      displayName: header.displayName,
      messageLines: header.message ? [header.message] : [],
    };
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    if (!line) continue;

    const timestampMatch = line.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\s+(.*))?$/);
    if (timestampMatch) {
      const [, hours, minutes, seconds, remainderRaw = ""] = timestampMatch;
      const numericMinutes = Number(minutes);
      const numericSeconds = Number(seconds);
      if (numericMinutes > 59 || numericSeconds > 59) {
        result.errors.push({ line: index + 1, message: "Invalid timestamp." });
        continue;
      }

      flushPendingZoomMessage(result, pendingMessage);
      pendingMessage = null;
      const offsetSeconds = timestampToSeconds(hours, minutes, seconds);
      const remainder = remainderRaw.trim();

      if (!remainder) {
        pendingTimestamp = { line: index + 1, offsetSeconds };
        continue;
      }

      pendingTimestamp = null;
      const header = parseMessageHeader(remainder);
      if (!header) {
        result.errors.push({ line: index + 1, message: "Expected HH:MM:SS Name: message." });
        continue;
      }
      startMessage(index + 1, offsetSeconds, header);
      continue;
    }

    if (pendingTimestamp) {
      const header = parseMessageHeader(line);
      if (header) {
        startMessage(pendingTimestamp.line, pendingTimestamp.offsetSeconds, header);
        pendingTimestamp = null;
        continue;
      }
      result.errors.push({ line: pendingTimestamp.line, message: "Expected a chat message after timestamp." });
      pendingTimestamp = null;
    }

    const continuation = pendingMessage as PendingZoomMessage | null;
    if (continuation) {
      // Any non-timestamp line following a recognized chat header is a message
      // continuation. This preserves long/wrapped copied text exactly instead
      // of silently discarding its second physical line.
      continuation.messageLines.push(line);
      continue;
    }

    result.errors.push({ line: index + 1, message: "Expected HH:MM:SS Name: message." });
  }

  if (pendingTimestamp) {
    result.errors.push({ line: pendingTimestamp.line, message: "Expected a chat message after timestamp." });
  }
  flushPendingZoomMessage(result, pendingMessage);
  return rebaseWallClockZoomTimestamps(result, normalizedInput);
}
