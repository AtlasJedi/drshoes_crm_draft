/**
 * TypeScript mirror of backend client DTOs.
 * Source of truth: backend/app/src/main/java/com/drshoes/app/client/dto/
 */

/** Preferred notification channel for a client. Matches DB CHECK constraint. */
export type PreferredChannel = "EMAIL" | "SMS" | "WHATSAPP";

/** Full client DTO — mirrors ClientDto.java. */
export interface ClientDto {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  preferredChannel: PreferredChannel | null;
  notes: string | null;
  rodoConsentAt: string | null; // ISO-8601, null = no consent
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

/**
 * PATCH /api/admin/clients/{id} — mirrors UpdateClientRequest.java.
 * preferredChannel: null = leave as-is, value = overwrite.
 * rodoConsent: true = set rodoConsentAt=now(), false = clear, null = no change.
 */
export interface UpdateClientRequest {
  firstName?: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  preferredChannel?: PreferredChannel | null;
  rodoConsent?: boolean | null;
  notes?: string | null;
}

/** GET /api/admin/clients/{id}/summary — mirrors ClientSummaryDto.java. */
export interface ClientSummary {
  clientId: string;
  orderCount: number;
  openOrderCount: number;
  lastOrderAt: string | null; // ISO-8601 or null
  unreadThreadCount: number;
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
