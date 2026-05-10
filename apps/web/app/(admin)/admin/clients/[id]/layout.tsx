/**
 * Server Component: shared shell for all three client detail sub-routes.
 * Fetches the client for notFound() guard; passes clientId to ClientTabNav.
 * ClientHeader and ClientSummaryTiles are rendered by each tab page (7-10+).
 * This layout only provides the nav shell.
 * ~45 LOC.
 */
import { notFound } from "next/navigation";
import { createLogger } from "@/lib/log";
import { getClientServer } from "@/lib/clients/api-server";
import { ClientTabNav } from "./_components/ClientTabNav";

const log = createLogger("client-detail-layout");

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ClientDetailLayout({ children, params }: Props) {
  const { id } = await params;
  log.info("op=layout.fetch", { clientId: id });

  let exists = true;
  try {
    await getClientServer(id);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      exists = false;
    } else {
      log.error("op=layout.fetch outcome=error", { clientId: id, err: String(err) });
      throw err;
    }
  }

  if (!exists) {
    log.info("op=layout.fetch outcome=not-found", { clientId: id });
    notFound();
  }

  return (
    <div>
      <div className="mb-4">
        <ClientTabNav clientId={id} />
      </div>
      {children}
    </div>
  );
}
