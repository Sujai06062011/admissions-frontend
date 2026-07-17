"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCampusSession } from "./CampusSessionProvider";
import type { CandidateSession } from "@/lib/candidateSession";

/**
 * There's no server-side session to check (see lib/candidateSession.ts) —
 * this only guards against landing on a portal/test page with nothing in
 * sessionStorage yet, e.g. a bookmarked link or a fresh tab.
 */
export function CampusGuard({
  children,
}: {
  children: (session: CandidateSession) => React.ReactNode;
}) {
  const router = useRouter();
  const { session, loading } = useCampusSession();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/campus");
    }
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="max-w-[640px] mx-auto px-6 pt-24 text-center text-sm text-text-muted">
        Loading…
      </div>
    );
  }

  if (!session) return null;

  return <>{children(session)}</>;
}
