import Link from "next/link";
import { createLogger } from "@/lib/log";
import { listUsersServer } from "@/lib/orders/api-server";
import { NewOrderForm } from "./_components/NewOrderForm";
import { NewOrderPageHeaderSetter } from "./_components/NewOrderPageHeaderSetter";

const log = createLogger("admin-orders-new-page");

export default async function NewOrderPage() {
  log.info("op=render");

  let users: import("@/lib/users/types").UserStubDto[] = [];

  try {
    users = await listUsersServer();
    log.info("op=fetchUsers outcome=success", { count: users.length });
  } catch (err) {
    log.warn("op=fetchUsers outcome=error", { message: String(err) });
    // Non-fatal: form still usable; assignee dropdown will be empty.
  }

  return (
    <div>
      <NewOrderPageHeaderSetter />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-admin-ink">Nowe zlecenie</h1>
        <Link
          href="/admin/orders"
          className="text-sm text-admin-mute hover:text-admin-ink transition-colors"
        >
          ← Wróć do zleceń
        </Link>
      </div>

      <NewOrderForm users={users} />
    </div>
  );
}
