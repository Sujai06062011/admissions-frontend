"use client";

import { useEffect, useRef, useState } from "react";
import type { Call, CallAgent } from "@azure/communication-calling";

type Props = {
  acsToken: string;
  teamsJoinUrl: string;
  displayName: string;
  onStateChange?: (state: string) => void;
};

export function GdCallClient({ acsToken, teamsJoinUrl, displayName, onStateChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [callState, setCallState] = useState("Idle");
  const callAgentRef = useRef<CallAgent | null>(null);
  const callRef = useRef<Call | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const { CallClient } = await import("@azure/communication-calling");
        const { AzureCommunicationTokenCredential } = await import(
          "@azure/communication-common"
        );
        const callClient = new CallClient();
        const credential = new AzureCommunicationTokenCredential(acsToken);
        const callAgent = await callClient.createCallAgent(credential, { displayName });
        if (cancelled) {
          callAgent.dispose();
          return;
        }
        callAgentRef.current = callAgent;
        const deviceManager = await callClient.getDeviceManager();
        await deviceManager.askDevicePermission({ audio: true, video: true });

        const call = callAgent.join(
          { meetingLink: teamsJoinUrl },
          { audioOptions: { muted: false } },
        );
        callRef.current = call;
        setCallState(call.state);
        onStateChange?.(call.state);
        call.on("stateChanged", () => {
          setCallState(call.state);
          onStateChange?.(call.state);
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!cancelled) setError(message);
      }
    }

    void connect();

    return () => {
      cancelled = true;
      const call = callRef.current;
      const agent = callAgentRef.current;
      callRef.current = null;
      callAgentRef.current = null;
      if (call && call.state !== "Disconnected") {
        void call.hangUp();
      }
      agent?.dispose();
    };
    // Intentionally omit onStateChange — parent setters are stable enough for smoke UI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acsToken, teamsJoinUrl, displayName]);

  return (
    <div className="rounded-[11px] border border-border bg-surface px-4 py-3">
      <div className="text-[13px] text-text-muted">
        Call status: <span className="font-semibold text-text">{callState}</span>
      </div>
      {error && <div className="mt-2 text-[13px] text-brick font-medium">{error}</div>}
      <p className="mt-2 text-[12.5px] text-text-muted leading-relaxed">
        Stay on this page during the discussion. If you see Lobby, wait for the host to admit you.
      </p>
    </div>
  );
}
