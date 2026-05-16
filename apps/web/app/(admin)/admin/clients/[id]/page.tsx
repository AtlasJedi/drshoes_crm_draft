/**
 * Client overview tab — /admin/clients/[id]
 * Server Component. Parallel fetches: client, summary, recent orders, recent threads.
 * Renders: ClientHeader + ClientSummaryTiles + ClientPreviewCards.
 * Spec §7.2.
 * ~55 LOC.
 */
import { notFound } from "next/navigation";
import { createLogger } from "@/lib/log";
import {
  getClientServer,
  getClientSummaryServer,
  listOrdersServer as listClientOrders,
} from "@/lib/clients/api-server";
import { listThreadsForClientServer } from "@/lib/messaging/api-server";
import { ClientHeader } from "./_components/ClientHeader";
import { ClientSummaryTiles } from "./_components/ClientSummaryTiles";
import { ClientDetailPageHeaderSetter } from "./_components/ClientDetailPageHeaderSetter";
import { ClientPreviewCards } from "./_components/ClientPreviewCards";

const log = createLogger("client-overview-page");

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientOverviewPage({ params }: Props) {
  const { id } = await params;
  log.info("op=render", { clientId: id });

  let results;
  try {
    results = await Promise.all([
      getClientServer(id),
      getClientSummaryServer(id),
      listClientOrders({ clientId: id, size: 5, page: 0 }),
      listThreadsForClientServer(id),
    ]);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      notFound();
    }
    log.error("op=render outcome=error", { clientId: id, err: String(err) });
    throw err;
  }

  const [client, summary, ordersPage, threads] = results;

  return (
    <div>
      <ClientDetailPageHeaderSetter
        name={[client.firstName, client.lastName].filter(Boolean).join(" ")}
        createdAt={client.createdAt}
      />
      <ClientHeader client={client} />
      <ClientSummaryTiles summary={summary} />
      <ClientPreviewCards
        recentOrders={ordersPage.content.slice(0, 5)}
        recentThreads={threads.slice(0, 3)}
      />
    </div>
  );
}
