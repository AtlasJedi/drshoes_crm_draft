"use client";

import { useState, useCallback } from "react";
import type { Channel } from "@/lib/messaging/types";

export interface ReplyComposerState {
  channel: Channel;
  subject: string;
  body: string;
  sending: boolean;
  sendError: string | null;
  setChannel: (c: Channel) => void;
  setSubject: (s: string) => void;
  setBody: (b: string) => void;
  setSending: (v: boolean) => void;
  setSendError: (e: string | null) => void;
  fillTemplate: (templateBody: string, templateSubject?: string | null) => void;
  reset: () => void;
}

/**
 * Extracts composer state from ReplyComposer to keep the component under 80 LOC.
 * Caller provides defaultChannel derived from thread.channel.
 * If defaultChannel is not EMAIL or SMS (e.g. WHATSAPP — out of M5 scope),
 * we defensively fall back to EMAIL so the toggle always has an active state.
 */
function resolveDefault(ch: Channel): Channel {
  return ch === "EMAIL" || ch === "SMS" ? ch : "EMAIL";
}

export function useReplyComposerState(defaultChannel: Channel): ReplyComposerState {
  const [channel, setChannel] = useState<Channel>(resolveDefault(defaultChannel));
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const fillTemplate = useCallback((templateBody: string, templateSubject?: string | null) => {
    setBody(templateBody);
    if (templateSubject) setSubject(templateSubject);
  }, []);

  const reset = useCallback(() => {
    setBody("");
    setSubject("");
    setSendError(null);
    setSending(false);
  }, []);

  return {
    channel, subject, body, sending, sendError,
    setChannel, setSubject, setBody, setSending, setSendError,
    fillTemplate, reset,
  };
}
