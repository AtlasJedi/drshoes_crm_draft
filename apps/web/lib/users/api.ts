import { api } from "@/lib/api";
import { createLogger } from "@/lib/log";
import type { UserStubDto } from "./types";

const log = createLogger("users-api");

/** GET /admin/users — returns all users as stubs for UI dropdowns. */
export async function listUsers(): Promise<UserStubDto[]> {
  log.info("op=listUsers");
  return api.get<UserStubDto[]>("/admin/users");
}
