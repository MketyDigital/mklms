import { normalizeSafeExternalUrl } from "../../../lib/security/external-url.ts";
import type { ViewerDisplayMode } from "../domain/live-session.ts";
import {
  parseLiveChatCsv,
  parseTimestampedLiveChat,
  type ImportedLiveChatItem,
  type LiveChatImportError,
} from "../domain/import-live-chat.ts";

export type LiveBatchAdminStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface AdminLiveBatchRecord {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: LiveBatchAdminStatus;
  expectedViewerBaseline: number;
  viewerDisplayMode: ViewerDisplayMode;
  endedMessage?: string | null;
  endedRedirectUrl?: string | null;
  notificationDestination?: string | null;
}

export interface AdminLiveSessionRecord {
  id: string;
  batchId: string;
  title: string;
  position: number;
  startsAt: Date;
  durationSeconds: number;
  mediaAssetId?: string | null;
  status: "DRAFT" | "PUBLISHED";
  ctaText?: string | null;
  ctaUrl?: string | null;
  ctaRevealOffsetSeconds?: number | null;
  endedMessage?: string | null;
  endedRedirectUrl?: string | null;
}

export interface AdminLiveClassRepository {
  createBatch(input: Omit<AdminLiveBatchRecord, "id">): Promise<AdminLiveBatchRecord>;
  updateBatch(batchId: string, input: Omit<AdminLiveBatchRecord, "id" | "status">): Promise<void>;
  deleteBatch(batchId: string): Promise<void>;
  createSession(batchId: string, input: Omit<AdminLiveSessionRecord, "id" | "batchId">): Promise<AdminLiveSessionRecord>;
  updateSession(sessionId: string, input: Omit<AdminLiveSessionRecord, "id" | "batchId" | "status">): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  findSessionById?(sessionId: string): Promise<AdminLiveSessionRecord | null>;
  replaceTimelineMessages(sessionId: string, items: ImportedLiveChatItem[]): Promise<unknown>;
  setBatchStatus(batchId: string, status: LiveBatchAdminStatus): Promise<void>;
}

function slugify(value: string): string {
  return value.trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "live-class";
}

function optionalText(value?: string | null): string | null {
  return value?.trim() || null;
}

function normalizeBatchInput(input: {
  title: string; slug?: string | null; description?: string | null; expectedViewerBaseline?: number | null;
  viewerDisplayMode?: ViewerDisplayMode; endedMessage?: string | null; endedRedirectUrl?: string | null; notificationDestination?: string | null;
}) {
  const title = input.title.trim();
  if (!title) throw new Error("Live class title is required.");
  const expectedViewerBaseline = Math.floor(input.expectedViewerBaseline ?? 0);
  if (!Number.isFinite(expectedViewerBaseline) || expectedViewerBaseline < 0) throw new Error("Viewer baseline cannot be negative.");
  return {
    title,
    slug: slugify(input.slug || title),
    description: optionalText(input.description),
    expectedViewerBaseline,
    viewerDisplayMode: input.viewerDisplayMode ?? "CONFIGURED_BASELINE" as ViewerDisplayMode,
    endedMessage: optionalText(input.endedMessage),
    endedRedirectUrl: normalizeSafeExternalUrl(input.endedRedirectUrl),
    notificationDestination: optionalText(input.notificationDestination),
  };
}

function normalizeSessionInput(input: {
  title: string; position: number; startsAt: Date; durationSeconds: number; mediaAssetId?: string | null;
  ctaText?: string | null; ctaUrl?: string | null; ctaRevealOffsetSeconds?: number | null;
  endedMessage?: string | null; endedRedirectUrl?: string | null;
}) {
  const title = input.title.trim();
  if (!title) throw new Error("Live session title is required.");
  if (!Number.isInteger(input.position) || input.position < 1 || input.position > 3) throw new Error("Live session position must be between 1 and 3.");
  if (!(input.startsAt instanceof Date) || Number.isNaN(input.startsAt.getTime())) throw new Error("Live session start time is invalid.");
  const durationSeconds = Math.floor(input.durationSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error("Live session duration must be positive.");
  const ctaRevealOffsetSeconds = input.ctaRevealOffsetSeconds ?? null;
  if (ctaRevealOffsetSeconds !== null && (!Number.isFinite(ctaRevealOffsetSeconds) || ctaRevealOffsetSeconds < 0)) throw new Error("CTA reveal offset cannot be negative.");
  return {
    title, position: input.position, startsAt: input.startsAt, durationSeconds,
    mediaAssetId: optionalText(input.mediaAssetId), ctaText: optionalText(input.ctaText),
    ctaUrl: normalizeSafeExternalUrl(input.ctaUrl),
    ctaRevealOffsetSeconds: ctaRevealOffsetSeconds === null ? null : Math.floor(ctaRevealOffsetSeconds),
    endedMessage: optionalText(input.endedMessage), endedRedirectUrl: normalizeSafeExternalUrl(input.endedRedirectUrl),
  };
}

function rebaseZoomClockItems(items: ImportedLiveChatItem[]): ImportedLiveChatItem[] {
  const firstOffset = items[0]?.offsetSeconds ?? 0;
  return items.map((item) => ({
    ...item,
    offsetSeconds: item.offsetSeconds >= firstOffset
      ? item.offsetSeconds - firstOffset
      : item.offsetSeconds + 24 * 60 * 60 - firstOffset,
  }));
}

export class AdminLiveClassService {
  private readonly repository: AdminLiveClassRepository;

  constructor(repository: AdminLiveClassRepository) {
    this.repository = repository;
  }

  async createBatch(input: Parameters<typeof normalizeBatchInput>[0]): Promise<AdminLiveBatchRecord> {
    return this.repository.createBatch({ ...normalizeBatchInput(input), status: "DRAFT" });
  }

  async updateBatch(batchId: string, input: Parameters<typeof normalizeBatchInput>[0]): Promise<void> {
    await this.repository.updateBatch(batchId, normalizeBatchInput(input));
  }

  deleteBatch(batchId: string): Promise<void> { return this.repository.deleteBatch(batchId); }

  async createSession(batchId: string, input: Parameters<typeof normalizeSessionInput>[0] & { status?: "DRAFT" | "PUBLISHED" }): Promise<AdminLiveSessionRecord> {
    return this.repository.createSession(batchId, { ...normalizeSessionInput(input), status: input.status ?? "DRAFT" });
  }

  async updateSession(sessionId: string, input: Parameters<typeof normalizeSessionInput>[0]): Promise<void> {
    await this.repository.updateSession(sessionId, normalizeSessionInput(input));
  }

  deleteSession(sessionId: string): Promise<void> { return this.repository.deleteSession(sessionId); }

  async createQuickTest(input: { title?: string; expectedViewerBaseline?: number; now?: Date } = {}) {
    const now = input.now ?? new Date();
    const suffix = now.toISOString().replace(/\D/g, "").slice(0, 14);
    const batch = await this.createBatch({ title: input.title?.trim() || "Live Room Test", slug: `live-room-test-${suffix}`, description: "Temporary no-media test room for verifying the live experience.", expectedViewerBaseline: input.expectedViewerBaseline ?? 100, viewerDisplayMode: "CONFIGURED_BASELINE", endedMessage: "This live-room test has ended." });
    const session = await this.createSession(batch.id, { title: "Test Session", position: 1, startsAt: new Date(now.getTime() - 5_000), durationSeconds: 15 * 60, mediaAssetId: null, status: "PUBLISHED" });
    await this.setBatchStatus(batch.id, "ACTIVE");
    return { batch: { ...batch, status: "ACTIVE" as const }, session };
  }

  async importTimeline(sessionId: string, input: { format: "csv" | "text"; content: string }): Promise<{ imported: number; errors: LiveChatImportError[] }> {
    const parsed = input.format === "csv" ? parseLiveChatCsv(input.content) : parseTimestampedLiveChat(input.content);
    let items = parsed.items;
    const errors = [...parsed.errors];
    const session = await this.repository.findSessionById?.(sessionId);

    if (session && items.length > 0) {
      const maxOffset = Math.max(...items.map((item) => item.offsetSeconds));
      if (maxOffset > session.durationSeconds) {
        const isZoomEveryoneExport = input.format === "text" && /From\s+.+?\s+to\s+Everyone\s*:/i.test(input.content);
        if (isZoomEveryoneExport) {
          const rebased = rebaseZoomClockItems(items);
          const rebasedMax = Math.max(...rebased.map((item) => item.offsetSeconds));
          if (rebasedMax <= session.durationSeconds) {
            items = rebased;
          } else {
            items = [];
            errors.push({ line: 0, message: "Imported Zoom chat still exceeds the selected session duration after clock-time rebasing." });
          }
        } else {
          items = [];
          errors.push({ line: 0, message: "Imported chat offset exceeds the selected session duration. Check that the file belongs to this session and uses video-relative offsets." });
        }
      }
    }

    if (items.length > 0) await this.repository.replaceTimelineMessages(sessionId, items);
    return { imported: items.length, errors };
  }

  setBatchStatus(batchId: string, status: LiveBatchAdminStatus): Promise<void> { return this.repository.setBatchStatus(batchId, status); }
}
