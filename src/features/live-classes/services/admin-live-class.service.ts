import { normalizeSafeExternalUrl } from "@/lib/security/external-url.ts";
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
  createSession(
    batchId: string,
    input: Omit<AdminLiveSessionRecord, "id" | "batchId">,
  ): Promise<AdminLiveSessionRecord>;
  replaceTimelineMessages(
    sessionId: string,
    items: ImportedLiveChatItem[],
  ): Promise<unknown>;
  setBatchStatus(batchId: string, status: LiveBatchAdminStatus): Promise<void>;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "live-class";
}

function optionalText(value?: string | null): string | null {
  return value?.trim() || null;
}

export class AdminLiveClassService {
  private readonly repository: AdminLiveClassRepository;

  constructor(repository: AdminLiveClassRepository) {
    this.repository = repository;
  }

  async createBatch(input: {
    title: string;
    slug?: string | null;
    description?: string | null;
    expectedViewerBaseline?: number | null;
    viewerDisplayMode?: ViewerDisplayMode;
    endedMessage?: string | null;
    endedRedirectUrl?: string | null;
    notificationDestination?: string | null;
  }): Promise<AdminLiveBatchRecord> {
    const title = input.title.trim();
    if (!title) throw new Error("Live class title is required.");

    const expectedViewerBaseline = Math.floor(input.expectedViewerBaseline ?? 0);
    if (!Number.isFinite(expectedViewerBaseline) || expectedViewerBaseline < 0) {
      throw new Error("Viewer baseline cannot be negative.");
    }

    return this.repository.createBatch({
      title,
      slug: slugify(input.slug || title),
      description: optionalText(input.description),
      status: "DRAFT",
      expectedViewerBaseline,
      viewerDisplayMode: input.viewerDisplayMode ?? "CONFIGURED_BASELINE",
      endedMessage: optionalText(input.endedMessage),
      endedRedirectUrl: normalizeSafeExternalUrl(input.endedRedirectUrl),
      notificationDestination: optionalText(input.notificationDestination),
    });
  }

  async createSession(
    batchId: string,
    input: {
      title: string;
      position: number;
      startsAt: Date;
      durationSeconds: number;
      mediaAssetId?: string | null;
      status?: "DRAFT" | "PUBLISHED";
      ctaText?: string | null;
      ctaUrl?: string | null;
      ctaRevealOffsetSeconds?: number | null;
      endedMessage?: string | null;
      endedRedirectUrl?: string | null;
    },
  ): Promise<AdminLiveSessionRecord> {
    const title = input.title.trim();
    if (!title) throw new Error("Live session title is required.");
    if (!Number.isInteger(input.position) || input.position < 1 || input.position > 3) {
      throw new Error("Live session position must be between 1 and 3.");
    }
    if (!(input.startsAt instanceof Date) || Number.isNaN(input.startsAt.getTime())) {
      throw new Error("Live session start time is invalid.");
    }
    const durationSeconds = Math.floor(input.durationSeconds);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new Error("Live session duration must be positive.");
    }
    const ctaRevealOffsetSeconds = input.ctaRevealOffsetSeconds ?? null;
    if (
      ctaRevealOffsetSeconds !== null &&
      (!Number.isFinite(ctaRevealOffsetSeconds) || ctaRevealOffsetSeconds < 0)
    ) {
      throw new Error("CTA reveal offset cannot be negative.");
    }

    return this.repository.createSession(batchId, {
      title,
      position: input.position,
      startsAt: input.startsAt,
      durationSeconds,
      mediaAssetId: optionalText(input.mediaAssetId),
      status: input.status ?? "DRAFT",
      ctaText: optionalText(input.ctaText),
      ctaUrl: normalizeSafeExternalUrl(input.ctaUrl),
      ctaRevealOffsetSeconds:
        ctaRevealOffsetSeconds === null ? null : Math.floor(ctaRevealOffsetSeconds),
      endedMessage: optionalText(input.endedMessage),
      endedRedirectUrl: normalizeSafeExternalUrl(input.endedRedirectUrl),
    });
  }

  async importTimeline(
    sessionId: string,
    input: { format: "csv" | "text"; content: string },
  ): Promise<{
    imported: number;
    errors: LiveChatImportError[];
  }> {
    const parsed =
      input.format === "csv"
        ? parseLiveChatCsv(input.content)
        : parseTimestampedLiveChat(input.content);

    if (parsed.items.length > 0) {
      await this.repository.replaceTimelineMessages(sessionId, parsed.items);
    }

    return {
      imported: parsed.items.length,
      errors: parsed.errors,
    };
  }

  setBatchStatus(batchId: string, status: LiveBatchAdminStatus): Promise<void> {
    return this.repository.setBatchStatus(batchId, status);
  }
}
