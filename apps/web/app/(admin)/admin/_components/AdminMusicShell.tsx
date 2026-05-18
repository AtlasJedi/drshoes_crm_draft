"use client";

/**
 * AdminMusicShell — client wrapper that provides MusicProvider + grid layout
 * for the admin chrome. The parent AdminLayout is an async SC (it calls getMe),
 * so provider state must live in this CC boundary.
 *
 * CSS grid: side | main (with topbar + content inside) + mini row at the bottom.
 * Mini row collapses when no track is current via .no-mini class.
 * ~40 LOC.
 */

import { MusicProvider, useMusicContext } from "@/components/admin/music/MusicProvider";
import { PersistentMiniPlayer } from "@/components/admin/music/PersistentMiniPlayer";

/** Inner wrapper that reads context to know if mini row is active */
function ShellInner({ children }: { children: React.ReactNode }) {
  const { current } = useMusicContext();
  return (
    <div className={"adm-shell" + (current ? "" : " no-mini")}>
      {children}
      <PersistentMiniPlayer />
    </div>
  );
}

interface Props {
  children: React.ReactNode;
}

export function AdminMusicShell({ children }: Props) {
  return (
    <MusicProvider>
      <ShellInner>{children}</ShellInner>
    </MusicProvider>
  );
}
