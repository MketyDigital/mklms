import nodemailer from "nodemailer";

import type {
  EmailProvider,
  SendEmailInput,
  SendEmailResult,
} from "./email-provider";

export interface SmtpEmailProviderOptions {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
}

export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(options: SmtpEmailProviderOptions) {
    this.from = options.from;
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth:
        options.user && options.password
          ? { user: options.user, pass: options.password }
          : undefined,
    });
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const result = await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.fileName,
        content: Buffer.from(attachment.bytes),
        contentType: attachment.contentType,
      })),
    });

    return { messageId: result.messageId ?? null };
  }
}

export function getConfiguredEmailProvider(): EmailProvider | null {
  if ((process.env.MKLMS_EMAIL_PROVIDER ?? "none") === "none") return null;

  const host = process.env.MKLMS_SMTP_HOST?.trim();
  const from = process.env.MKLMS_EMAIL_FROM?.trim();
  if (!host || !from) {
    throw new Error(
      "SMTP email is not configured. Set MKLMS_SMTP_HOST and MKLMS_EMAIL_FROM or select another EmailProvider adapter.",
    );
  }

  return new SmtpEmailProvider({
    host,
    port: Number(process.env.MKLMS_SMTP_PORT ?? 587),
    secure: process.env.MKLMS_SMTP_SECURE === "true",
    user: process.env.MKLMS_SMTP_USER?.trim() || undefined,
    password: process.env.MKLMS_SMTP_PASSWORD || undefined,
    from,
  });
}
