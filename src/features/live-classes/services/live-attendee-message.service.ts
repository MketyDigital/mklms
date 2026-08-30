import type { LiveAttendeeMessageRecord } from "./live-room.service.ts";

export interface LiveAttendeeMessageRepository {
  createAttendeeMessage(input: {
    batchId: string;
    sessionId: string;
    viewerId: string;
    displayName?: string | null;
    message: string;
  }): Promise<LiveAttendeeMessageRecord>;
}

export interface NotificationProvider {
  notify(input: {
    title: string;
    message: string;
    destination?: string | null;
    context?: Record<string, string>;
  }): Promise<void>;
}

export class LiveAttendeeMessageService {
  private readonly repository: LiveAttendeeMessageRepository;
  private readonly notificationProvider: NotificationProvider | null;

  constructor(
    repository: LiveAttendeeMessageRepository,
    notificationProvider: NotificationProvider | null,
  ) {
    this.repository = repository;
    this.notificationProvider = notificationProvider;
  }

  async send(input: {
    batchId: string;
    sessionId: string;
    viewerId: string;
    displayName?: string | null;
    message: string;
    batchTitle: string;
    sessionTitle: string;
    notificationDestination?: string | null;
  }): Promise<{
    ok: true;
    message: LiveAttendeeMessageRecord;
    notificationDelivered: boolean;
  }> {
    const message = input.message.trim();
    if (!message) throw new Error("Attendee message is required.");
    if (message.length > 4000) throw new Error("Attendee message is too long.");

    const displayName = input.displayName?.trim() || "Attendee";
    const record = await this.repository.createAttendeeMessage({
      batchId: input.batchId,
      sessionId: input.sessionId,
      viewerId: input.viewerId,
      displayName,
      message,
    });

    let notificationDelivered = false;
    if (this.notificationProvider) {
      try {
        await this.notificationProvider.notify({
          title: `Live class message — ${input.batchTitle}`,
          message: `${displayName} (${input.sessionTitle}): ${message}`,
          destination: input.notificationDestination ?? null,
          context: {
            batchId: input.batchId,
            sessionId: input.sessionId,
            viewerId: input.viewerId,
            messageId: record.id,
          },
        });
        notificationDelivered = true;
      } catch {
        notificationDelivered = false;
      }
    }

    return { ok: true, message: record, notificationDelivered };
  }
}
