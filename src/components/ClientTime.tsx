"use client";

import { useSyncExternalStore } from "react";

const NO_OP_SUBSCRIBE = () => () => {};

/**
 * Renders a timestamp in the visitor's own locale and timezone.
 *
 * Formatting on the server and again on the client produces two different
 * strings whenever their timezones differ, which React reports as a hydration
 * mismatch. This renders a placeholder for the server and the hydration pass,
 * then the real value once the client has taken over.
 */
export function ClientTime({ value }: { value: string }) {
  const isHydrated = useSyncExternalStore(
    NO_OP_SUBSCRIBE,
    () => true,
    () => false
  );

  return <time dateTime={value}>{isHydrated ? new Date(value).toLocaleString() : " "}</time>;
}
