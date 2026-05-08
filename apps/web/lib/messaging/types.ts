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
}

export interface SendMessageRequest {
  templateId: string;
  channel: Channel;
  subject?: string | null;
}
