"use client";

/**
 * PageHeaderContext — lets any admin page set the topbar title + subtitle.
 * usePageHeader(h) is called at the top of each page.tsx and uses useEffect
 * with [h.title, h.subtitle] deps to avoid render storms.
 * ~55 LOC.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createLogger } from "@/lib/log";

const log = createLogger("admin.page-header-ctx");

export interface PageHeader {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

interface ContextValue {
  current: PageHeader | null;
  set: (h: PageHeader) => void;
}

const PageHeaderContext = createContext<ContextValue>({
  current: null,
  set: () => {},
});

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<PageHeader | null>(null);
  const set = useCallback((h: PageHeader) => {
    log.debug("op=PageHeaderContext.set", { title: h.title });
    setCurrent(h);
  }, []);
  return (
    <PageHeaderContext.Provider value={{ current, set }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeaderContext(): ContextValue {
  return useContext(PageHeaderContext);
}

/** Call at the top of a page component to set the topbar heading. */
export function usePageHeader(h: PageHeader): void {
  const { set } = usePageHeaderContext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { set(h); }, [h.title, h.subtitle]);
}
