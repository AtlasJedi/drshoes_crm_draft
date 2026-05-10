export type Channel = "EMAIL" | "SMS" | "WHATSAPP";

export interface TemplateDto {
  id: string;
  name: string;
  channel: Channel;
  subject: string | null;
  body: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest {
  name: string;
  channel: Channel;
  subject?: string | null;
  body: string;
  active?: boolean;
}

export interface UpdateTemplateRequest {
  name?: string;
  channel?: Channel;
  subject?: string | null;
  body?: string;
  active?: boolean;
}

export interface TriggerDto {
  id: string;
  name: string;
  enabled: boolean;
  event: string;
  eventParams: string;     // JSON string
  channels: string;        // JSON string array
  templateId: string;
  templateName: string;
  delayMinutes: number;
  requiresManualConfirmation: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  orderId: string | null;
  clientId: string;
  direction: "OUTBOUND" | "INBOUND";
  channel: Channel;
  templateId: string | null;
  triggerId: string | null;
  subject: string | null;
  body: string;
  deliveryStatus: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "READ";
  providerMessageId: string | null;
  sentAt: string | null;
  createdAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  retryOfMessageId: string | null;
  retryAttempt: number;
}

export interface SendMessageRequest {
  templateId: string;
  channel: Channel;
  subject?: string | null;
}

export type ThreadFilter = "ALL" | "UNREAD" | "UNMATCHED";

export interface MessageThreadDto {
  id: string;
  clientId: string | null;
  rawSender: string | null;
  channel: Channel;
  subject: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string | null;
  unmatched: boolean;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  discardedAt: string | null;
}

export interface ThreadDetailDto {
  thread: MessageThreadDto;
  messages: MessageDto[];
}

export interface SendReplyRequest {
  channel: Channel;
  subject?: string | null;
  body: string;
  orderId?: string | null;
}

export interface SendNewRequest {
  channel: Channel;
  subject?: string | null;
  body: string;
}
