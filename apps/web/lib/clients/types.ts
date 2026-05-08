/**
 * TypeScript mirror of backend client DTOs.
 * Source of truth: backend/app/src/main/java/com/drshoes/app/client/dto/
 *
 * NOTE: ClientDto.java omits preferredChannel and rodoConsentAt from its record
 * definition (backend concern logged as concern in dispatch log 1-12-*). The fields
 * ARE present on the Client entity and declared here for completeness; they will be
 * absent from API responses until the backend DTO is updated.
 */

/** Preferred notification channel for a client. Matches DB CHECK constraint. */
export type PreferredChannel = "EMAIL" | "SMS" | "NONE";

/**
 * Full client DTO — mirrors ClientDto.java.
 * lastName: nullable per V001 schema (last_name VARCHAR(80) without NOT NULL).
 * preferredChannel + rodoConsentAt: present on entity; omitted from current DTO
 * (see Concerns in dispatch log).
 */
export interface ClientDto {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  preferredChannel?: PreferredChannel;
  notes: string | null;
  rodoConsentAt?: string | null; // ISO-8601
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

/** Typeahead search result — mirrors ClientSearchResult.java. */
export interface ClientSearchResult {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
}

/** POST /api/admin/clients — mirrors CreateClientRequest.java. */
export interface CreateClientRequest {
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

/** PATCH /api/admin/clients/{id} — mirrors UpdateClientRequest.java. All fields optional. */
export interface UpdateClientRequest {
  firstName?: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

/** Query params for GET /api/admin/clients (Spring Pageable). */
export interface ClientListParams {
  page?: number;
  size?: number;
  sort?: string;
}

/** Spring Page wrapper (generic). */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  last: boolean;
}
