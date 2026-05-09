import { api } from "@/lib/api";
import { createLogger } from "@/lib/log";
import type {
  TemplateDto,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TriggerDto,
  MessageDto,
  SendMessageRequest,
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
