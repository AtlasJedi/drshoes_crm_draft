import { Suspense } from "react";
import { MessagesShell } from "./_components/MessagesShell";
import { MessagesPageHeaderSetter } from "./_components/MessagesPageHeaderSetter";

interface Props {
  searchParams: Promise<{ thread?: string }>;
}

/**
 * Server component: reads ?thread= deep-link from OrderDrawer.
 * All client state lives in MessagesShell.
 */
export default async function MessagesPage({ searchParams }: Props) {
  const { thread } = await searchParams;
  return (
    <>
      <MessagesPageHeaderSetter />
      <Suspense>
        <MessagesShell initialThreadId={thread ?? null} />
      </Suspense>
    </>
  );
}
