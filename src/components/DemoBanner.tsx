"use client";

import { useSyncExternalStore } from "react";
import { Github, WifiOff, X } from "lucide-react";
import { DEMO_STORAGE, PROJECT_REPO_URL } from "@/lib/demo/config";

/**
 * Persistent, dismissible strip that says plainly what this build is.
 * Rendered only when NEXT_PUBLIC_DEMO_MODE is on.
 *
 * "Dismissed" lives in localStorage, which React reads through
 * useSyncExternalStore so the server pass and the hydration pass agree: both
 * treat the banner as hidden, and it appears once the client takes over.
 */
let listeners: Array<() => void> = [];

function subscribe(onStoreChange: () => void): () => void {
  listeners.push(onStoreChange);
  return () => {
    listeners = listeners.filter((listener) => listener !== onStoreChange);
  };
}

function isDismissed(): boolean {
  try {
    return window.localStorage.getItem(DEMO_STORAGE.bannerDismissed) === "1";
  } catch {
    return false;
  }
}

function isDismissedOnServer(): boolean {
  return true;
}

function dismiss(): void {
  try {
    window.localStorage.setItem(DEMO_STORAGE.bannerDismissed, "1");
  } catch {
    /* Private-mode browsers reject writes; the banner still closes for this page. */
  }
  for (const listener of listeners) {
    listener();
  }
}

export function DemoBanner() {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, isDismissedOnServer);

  if (dismissed) {
    return null;
  }

  return (
    <div className="demo-banner" role="note">
      <WifiOff aria-hidden="true" />
      <p>
        <strong>Demo build.</strong>{" "}
        Seeded data, no server, no API keys, no outbound requests — so nothing here can be abused or run up someone
        else&apos;s bill. The full application, and the steps to run it live, are in the repo.
      </p>
      <a className="neo-button demo-banner-link" href={PROJECT_REPO_URL} target="_blank" rel="noreferrer">
        <Github aria-hidden="true" />
        Source
      </a>
      <button className="demo-banner-close" type="button" aria-label="Dismiss demo notice" onClick={dismiss}>
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
