"use client";

import { useState, useCallback } from "react";
import type { Channel } from "@/lib/messaging/types";

export interface ReplyComposerState {
  channel: Channel;
  body: string;
  sending: boolean;
  sendError: string | null;
  setChannel: (c: Channel) => void;
  setBody: (b: string) => void;
  setSending: (v: boolean) => void;
  setSendError: (e: string | null) => void;
  fillTemplate: (templateBody: string) => void;
  reset: () => void;
}

/**
 * Extracts composer state from ReplyComposer to keep the component under 80 LOC.
 * Caller provides defaultChannel derived from thread.channel.
 * If defaultChannel is not EMAIL or SMS (e.g. WHATSAPP — out of M5 scope),
 * we defensively fall back to EMAIL so the toggle always has an active state.
 *
 * v2-E: subject field removed — EMAIL subject is pinned by the followup template
 * on the backend. Operators no longer need to type or see it.
 */
function resolveDefault(ch: Channel): Channel {
  return ch === "EMAIL" || ch === "SMS" ? ch : "EMAIL";
}

export function useReplyComposerState(defaultChannel: Channel): ReplyComposerState {
  const [channel, setChannel] = useState<Channel>(resolveDefault(defaultChannel));
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const fillTemplate = useCallback((templateBody: string) => {
    setBody(templateBody);
  }, []);

  const reset = useCallback(() => {
    setBody("");
    setSendError(null);
    setSending(false);
  }, []);

  return {
    channel, body, sending, sendError,
    setChannel, setBody, setSending, setSendError,
    fillTemplate, reset,
  };
}
