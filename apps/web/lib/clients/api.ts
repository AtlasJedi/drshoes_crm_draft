import { api } from "@/lib/api";
import { createLogger } from "@/lib/log";
import type {
  ClientDto,
  ClientSearchResult,
  CreateClientRequest,
  UpdateClientRequest,
  Page,
} from "./types";

const log = createLogger("clients-api");

/** GET /admin/clients/search?q=<query> — typeahead, returns top-N results. */
export async function searchClients(q: string): Promise<ClientSearchResult[]> {
  log.info("op=searchClients", { q });
  return api.get<ClientSearchResult[]>(`/admin/clients/search?q=${encodeURIComponent(q)}`);
}

/** GET /admin/clients?page=&size= — paginated client list. */
export async function listClients(page = 0, size = 20): Promise<Page<ClientDto>> {
  log.info("op=listClients", { page, size });
  return api.get<Page<ClientDto>>(`/admin/clients?page=${page}&size=${size}`);
}

/** GET /admin/clients/{id} — single client. */
export async function getClient(id: string): Promise<ClientDto> {
  log.info("op=getClient", { id });
  return api.get<ClientDto>(`/admin/clients/${id}`);
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
