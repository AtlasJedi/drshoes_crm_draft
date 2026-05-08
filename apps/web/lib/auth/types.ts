export type UserRole = "OWNER" | "EMPLOYEE" | "CRAFTSMAN" | "OFFICE";

export interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  lastLoginAt: string | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
  requestId?: string;
}
