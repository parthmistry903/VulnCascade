"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { History, LogOut, Radar, RotateCcw, UserCircle } from "lucide-react";
import { fetchCurrentUser, signOut } from "@/lib/api-client";
import { DEMO_MODE } from "@/lib/demo/config";
import type { AuthUser } from "@/lib/types";

export function AppNav() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [canReset, setCanReset] = useState(false);

  useEffect(() => {
    let ignore = false;

    void (async () => {
      const current = await fetchCurrentUser().catch(() => null);
      if (ignore) {
        return;
      }
      setUser(current);

      if (DEMO_MODE && current) {
        const { isDemoDirty } = await import("@/lib/demo/store");
        if (!ignore) {
          setCanReset(isDemoDirty());
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleSignOut(): Promise<void> {
    try {
      await signOut();
    } finally {
      setUser(null);
      router.push("/login");
      router.refresh();
    }
  }

  async function handleReset(): Promise<void> {
    const { resetDemoData } = await import("@/lib/demo/store");
    resetDemoData();
    window.location.href = "/history";
  }

  return (
    <header className="top-nav">
      <Link href="/" className="brand" aria-label="VulnCascade home">
        <Image src="/logo.svg" alt="VulnCascade Logo" width={42} height={42} priority />
        <span>
          <h1 className="brand-title">
            VulnCascade
            {DEMO_MODE ? <span className="badge demo-chip brand-demo-chip">Demo</span> : null}
          </h1>
          <p className="brand-subtitle">CVE Risk Mapper</p>
        </span>
      </Link>
      <nav className="nav-actions" aria-label="Primary navigation">
        {user ? (
          <>
            <Link href="/" className="neo-button">
              <Radar aria-hidden="true" />
              New Scan
            </Link>
            <Link href="/history" className="neo-button">
              <History aria-hidden="true" />
              History
            </Link>
            {canReset ? (
              <button
                className="neo-button"
                type="button"
                title="Restore the seeded demo workspace"
                onClick={() => void handleReset()}
              >
                <RotateCcw aria-hidden="true" />
                Reset Demo
              </button>
            ) : null}
            <span className="auth-chip" title={user.email}>
              <UserCircle aria-hidden="true" />
              {user.name}
            </span>
            <button className="neo-button" type="button" onClick={() => void handleSignOut()}>
              <LogOut aria-hidden="true" />
              Sign Out
            </button>
          </>
        ) : null}
      </nav>
    </header>
  );
}
