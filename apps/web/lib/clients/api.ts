import { api } from "@/lib/api";
import { createLogger } from "@/lib/log";
import type {
  ClientDto,
  ClientSearchResult,
  ClientSummary,
  CreateClientRequest,
  UpdateClientRequest,
  Page,
} from "./types";

const log = createLogger("apps/web/lib/clients");

/** GET /admin/clients/search?q=<query> — typeahead, returns top-N results. */
export async function searchClients(q: string): Promise<ClientSearchResult[]> {
  log.info("op=searchClients", { q });
  return api.get<ClientSearchResult[]>(`/admin/clients/search?q=${encodeURIComponent(q)}`);
}

/** GET /admin/clients?page=&size= — paginated client list. */
export async function listClients(opts: { page?: number; size?: number }): Promise<Page<ClientDto>> {
  const page = opts.page ?? 0;
  const size = opts.size ?? 20;
  log.info("op=listClients", { page, size });
  return api.get<Page<ClientDto>>(`/admin/clients?page=${page}&size=${size}`);
}

/** GET /admin/clients/{id} — single client. */
export async function getClient(id: string): Promise<ClientDto> {
  log.info("op=getClient", { id });
  return api.get<ClientDto>(`/admin/clients/${id}`);
}

/** GET /admin/clients/{id}/summary — aggregate header tiles. */
export async function getClientSummary(id: string): Promise<ClientSummary> {
  log.info("op=getClientSummary", { id });
  return api.get<ClientSummary>(`/admin/clients/${id}/summary`);
}

/** POST /admin/clients — create a new client, returns full ClientDto. */
export async function createClient(req: CreateClientRequest): Promise<ClientDto> {
  log.info("op=createClient");
  return api.post<ClientDto>("/admin/clients", req);
}

/** PATCH /admin/clients/{id} — update client fields, returns updated ClientDto. */
export async function updateClient(id: string, req: UpdateClientRequest): Promise<ClientDto> {
  log.info("op=updateClient", { id });
  return api.patch<ClientDto>(`/admin/clients/${id}`, req);
}

/** DELETE /admin/clients/{id} — soft-delete (OWNER only). Returns 204 void. */
export async function deleteClient(id: string): Promise<void> {
  log.info("op=deleteClient", { id });
  return api.delete<void>(`/admin/clients/${id}`);
}
