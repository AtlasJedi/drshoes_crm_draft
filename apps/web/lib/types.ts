/**
 * Shared types used across multiple lib modules.
 * Domain-specific types live in lib/<domain>/types.ts.
 */

export type StorageLocation = {
  id: number;
  name: string;
  position: number;
  active: boolean;
};

export type AddOrderNotePayload = {
  note?: string;
  location?: string;
};

export type AddOrderNoteResult = {
  auditEntryId: string;
  note: string | null;
  locationFrom: string | null;
  locationTo: string | null;
  createdAt: string; // ISO instant
};
