export interface NotificationInput {
  title: string;
  message: string;
  destination?: string | null;
  context?: Record<string, string>;
}

export interface NotificationProvider {
  notify(input: NotificationInput): Promise<void>;
}
