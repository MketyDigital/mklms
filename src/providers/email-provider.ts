export interface EmailAttachment {
  fileName: string;
  bytes: Uint8Array;
  contentType: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  messageId?: string | null;
}

export interface EmailProvider {
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
}
