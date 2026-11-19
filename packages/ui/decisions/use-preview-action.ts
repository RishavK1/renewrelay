"use client";

import { isUnconfirmedResult } from "./action-policy";

import { useEffect, useRef, useState } from "react";
import type { DecisionFailure } from "./contracts";

export function useDecisionAction<C, R extends { status: "success" } | DecisionFailure>(action: (command: C, signal: AbortSignal) => Promise<R>, freezeUnknown: (command: C) => boolean = () => true, operation: (command: C) => string = () => "submit") {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<DecisionFailure | null>(null);
  const [frozen, setFrozen] = useState<C | null>(null);
  const [rate, setRate] = useState({ until: 0, operation: "" });
  const [remaining, setRemaining] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!rate.until) return;
    const sync = () => setRemaining(Math.max(0, Math.ceil((rate.until - Date.now()) / 1000)));
    sync(); const timer = window.setInterval(sync, 1000); return () => window.clearInterval(timer);
  }, [rate.until]);
  async function run(command: C): Promise<R | null> {
    const input = frozen ?? command;
    if (request.current || remaining > 0 && operation(input) === rate.operation) return null;
    const controller = new AbortController(); request.current = controller; setPending(true); setFailure(null);
    try {
      const result = await action(input, controller.signal);
      if (controller.signal.aborted) return null;
      if (result.status === "error") {
        setFailure(result); setFrozen(isUnconfirmedResult(result.code) && freezeUnknown(input) ? input : null);
        if (result.retryAfterSeconds) { setRemaining(result.retryAfterSeconds); setRate({ until: Date.now() + result.retryAfterSeconds * 1000, operation: operation(input) }); }
      } else setFrozen(null);
      return result;
    } catch {
      if (!controller.signal.aborted) {
        setFrozen(freezeUnknown(input) ? input : null);
        setFailure({ status: "error", code: "connection_error", message: "The result couldn’t be confirmed. Check your connection before retrying." });
      }
      return null;
    } finally { if (!controller.signal.aborted) { request.current = null; setPending(false); } }
  }
  return { pending, failure, frozen, remaining, limitedOperation: rate.operation, run, clearFailure: () => setFailure(null) };
}
