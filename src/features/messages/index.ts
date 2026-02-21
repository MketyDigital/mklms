import type { MessageService } from "./services/message.service";
import { mockMessageService } from "./services/message.mock";
import { apiMessageService } from "./services/message.api";

export const messageService: MessageService =
  process.env.USE_MOCKS === "true" || !process.env.NEXT_PUBLIC_API_URL
    ? mockMessageService
    : apiMessageService;

export * from "./types";
export * from "./schemas";
export type { MessageService } from "./services/message.service";
