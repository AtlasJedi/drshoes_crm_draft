import { api } from "@/lib/api";
import { createLogger } from "@/lib/log";
import type {
  TemplateDto,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TriggerDto,
  MessageDto,
  SendMessageRequest,
  MessageThreadDto,
  ThreadDetailDto,
  ThreadFilter,
  Channel,
  SendReplyRequest,
  SendNewRequest,
} from "./types";

const log = createLogger("messaging.api");

export async function getTemplates(): Promise<TemplateDto[]> {
  log.info("op=getTemplates");
  return api.get<TemplateDto[]>("/admin/templates");
}

export async function getTemplate(id: string): Promise<TemplateDto> {
  log.info("op=getTemplate", { id });
  return api.get<TemplateDto>(`/admin/templates/${id}`);
}

export async function createTemplate(req: CreateTemplateRequest): Promise<TemplateDto> {
  log.info("op=createTemplate", { name: req.name, channel: req.channel });
  return api.post<TemplateDto>("/admin/templates", req);
}

export async function updateTemplate(id: string, req: UpdateTemplateRequest): Promise<TemplateDto> {
  log.info("op=updateTemplate", { id });
  return api.patch<TemplateDto>(`/admin/templates/${id}`, req);
}

export async function deleteTemplate(id: string): Promise<void> {
  log.info("op=deleteTemplate", { id });
  return api.delete<void>(`/admin/templates/${id}`);
}

export async function getTriggers(): Promise<TriggerDto[]> {
  log.info("op=getTriggers");
  return api.get<TriggerDto[]>("/admin/triggers");
}

export async function getTrigger(id: string): Promise<TriggerDto> {
  log.info("op=getTrigger", { id });
  return api.get<TriggerDto>(`/admin/triggers/${id}`);
}

export async function toggleTrigger(id: string, enabled: boolean): Promise<TriggerDto> {
  log.info("op=toggleTrigger", { id, enabled });
  return api.patch<TriggerDto>(`/admin/triggers/${id}/enabled`, { enabled });
}

export async function getOrderMessages(orderId: string): Promise<MessageDto[]> {
  log.info("op=getOrderMessages", { orderId });
  return api.get<MessageDto[]>(`/admin/orders/${orderId}/messages`);
}

export async function sendMessage(orderId: string, req: SendMessageRequest): Promise<MessageDto> {
  log.info("op=sendMessage", { orderId, templateId: req.templateId, channel: req.channel });
  return api.post<MessageDto>(`/admin/orders/${orderId}/messages`, req);
}

export async function retryMessage(id: string): Promise<MessageDto> {
  log.info("op=retryMessage", { id });
  return api.post<MessageDto>(`/admin/messages/${id}/retry`);
}

export async function listThreads(
  filter?: ThreadFilter,
  channel?: Channel,
  q?: string,
): Promise<MessageThreadDto[]> {
  const params = new URLSearchParams();
  if (filter) params.set("filter", filter);
  if (channel) params.set("channel", channel);
  if (q && q.length >= 2) params.set("q", q);
  const qs = params.toString();
  log.info("op=listThreads", { filter, channel, q });
  return api.get<MessageThreadDto[]>(`/admin/threads${qs ? "?" + qs : ""}`);
}

export async function getThread(id: string): Promise<ThreadDetailDto> {
  log.info("op=getThread", { id });
  return api.get<ThreadDetailDto>(`/admin/threads/${id}`);
}

export async function sendReply(
  threadId: string,
  req: SendReplyRequest,
): Promise<MessageDto> {
  log.info("op=sendReply", { threadId, channel: req.channel });
  return api.post<MessageDto>(`/admin/threads/${threadId}/messages`, req);
}

export async function markThreadRead(threadId: string): Promise<MessageThreadDto> {
  log.info("op=markThreadRead", { threadId });
  return api.post<MessageThreadDto>(`/admin/threads/${threadId}/mark-read`);
}

export async function assignUnmatched(
  threadId: string,
  clientId: string,
): Promise<MessageThreadDto> {
  log.info("op=assignUnmatched", { threadId, clientId });
  return api.post<MessageThreadDto>(`/admin/threads/${threadId}/assign`, { clientId });
}

export async function discardUnmatched(threadId: string): Promise<MessageThreadDto> {
  log.info("op=discardUnmatched", { threadId });
  return api.post<MessageThreadDto>(`/admin/threads/${threadId}/discard`);
}

export async function sendNewToClient(
  clientId: string,
  req: SendNewRequest,
): Promise<MessageDto> {
  log.info("op=sendNewToClient", { clientId, channel: req.channel });
  return api.post<MessageDto>(`/admin/clients/${clientId}/messages`, req);
}
