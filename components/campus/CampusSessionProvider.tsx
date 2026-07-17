"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  clearCandidateSession,
  loadCandidateSession,
  saveCandidateSession,
  type CandidateSession,
} from "@/lib/candidateSession";

interface CampusSessionContextValue {
  session: CandidateSession | null;
  loading: boolean;
  setSession: (session: CandidateSession) => void;
  clearSession: () => void;
}

const CampusSessionContext = createContext<CampusSessionContextValue | null>(null);

export function CampusSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<CandidateSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // sessionStorage is only readable client-side; deferring the read into a
    // microtask (rather than calling setState synchronously in the effect
    // body) avoids the render triggered by this effect cascading directly
    // into another synchronous render.
    Promise.resolve().then(() => {
      setSessionState(loadCandidateSession());
      setLoading(false);
    });
  }, []);

  function setSession(next: CandidateSession) {
    saveCandidateSession(next);
    setSessionState(next);
  }

  function clearSession() {
    clearCandidateSession();
    setSessionState(null);
  }

  return (
    <CampusSessionContext.Provider value={{ session, loading, setSession, clearSession }}>
      {children}
    </CampusSessionContext.Provider>
  );
}

export function useCampusSession(): CampusSessionContextValue {
  const ctx = useContext(CampusSessionContext);
  if (!ctx) {
    throw new Error("useCampusSession must be used within a CampusSessionProvider");
  }
  return ctx;
}
