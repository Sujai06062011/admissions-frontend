"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";
import {
  CallComposite,
  useAzureCommunicationCallAdapter,
  type CallAdapter,
  type CallCompositePage,
} from "@azure/communication-react";
import "@fluentui/react/dist/css/fabric.min.css";

type Props = {
  acsUserId: string;
  acsToken: string;
  teamsJoinUrl: string;
  displayName: string;
  onPageChange?: (page: CallCompositePage) => void;
};

/** Candidate controls — keep Raise hand; hide Hold/Captions/RTT/Phone/View. */
const CANDIDATE_CALL_CONTROLS = {
  cameraButton: true,
  microphoneButton: true,
  screenShareButton: false,
  peopleButton: true,
  moreButton: false,
  holdButton: false,
  captionsButton: false,
  realTimeTextButton: false,
  teamsMeetingPhoneCallButton: false,
  galleryControlsButton: false,
  raiseHandButton: true,
  reactionButton: false,
  devicesButton: true,
  dtmfDialerButton: false,
} as const;

const BUSY_PAGES = new Set<CallCompositePage>([
  "call",
  "lobby",
  "transferring",
  "hold",
  "leaving",
]);

export function GdCallComposite({
  acsUserId,
  acsToken,
  teamsJoinUrl,
  displayName,
  onPageChange,
}: Props) {
  const [page, setPage] = useState<CallCompositePage | null>(null);
  /** Track which adapter instance we already asked to join — never spam joinCall. */
  const joinedAdapterRef = useRef<CallAdapter | null>(null);

  const credential = useMemo(
    () => new AzureCommunicationTokenCredential(acsToken),
    [acsToken],
  );

  const adapterArgs = useMemo(
    () => ({
      userId: { communicationUserId: acsUserId },
      displayName,
      credential,
      locator: { meetingLink: teamsJoinUrl },
    }),
    [acsUserId, credential, displayName, teamsJoinUrl],
  );

  const joinOnce = useCallback(async (adapter: CallAdapter) => {
    if (joinedAdapterRef.current === adapter) return;
    const pageNow = adapter.getState().page;
    if (BUSY_PAGES.has(pageNow)) {
      joinedAdapterRef.current = adapter;
      return;
    }
    joinedAdapterRef.current = adapter;
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch {
      // Permissions may be granted from in-call controls.
    }
    try {
      adapter.joinCall({ microphoneOn: true, cameraOn: true });
    } catch {
      // Already joining.
    }
  }, []);

  const afterCreate = useCallback(
    async (adapter: CallAdapter) => {
      await joinOnce(adapter);
      return adapter;
    },
    [joinOnce],
  );

  const adapter = useAzureCommunicationCallAdapter(adapterArgs, afterCreate);

  useEffect(() => {
    if (!adapter) return;

    const onState = (state: { page: CallCompositePage }) => {
      setPage(state.page);
      onPageChange?.(state.page);
    };

    onState(adapter.getState());
    adapter.onStateChange(onState);
    return () => adapter.offStateChange(onState);
  }, [adapter, onPageChange]);

  const rejoin = useCallback(() => {
    if (!adapter) return;
    // Allow a fresh joinCall after user left.
    joinedAdapterRef.current = null;
    void joinOnce(adapter);
  }, [adapter, joinOnce]);

  const [consentVisible, setConsentVisible] = useState(false);
  const stillJoining = !adapter || page === null || page === "configuration";
  const leftCall = page === "leftCall";
  const inCall = page === "call" || page === "lobby";

  // ACS recording toast stays forever while recording is on (host dismiss does not clear it).
  // We hide ACS notifications and show a short consent note instead.
  useEffect(() => {
    if (!inCall) return;
    setConsentVisible(true);
    const t = window.setTimeout(() => setConsentVisible(false), 8000);
    return () => window.clearTimeout(t);
  }, [inCall]);

  return (
    <div
      className="gd-call-composite relative h-[min(72vh,640px)] w-full overflow-hidden rounded-[14px] border border-border bg-[#111]"
      data-joining={stillJoining ? "true" : "false"}
    >
      <style>{`
        .gd-call-composite[data-joining="true"] [data-ui-id="call-composite-configuration-page"],
        .gd-call-composite[data-joining="true"] [class*="configurationPage"],
        .gd-call-composite[data-joining="true"] [class*="ConfigurationPage"] {
          visibility: hidden !important;
        }
      `}</style>

      {stillJoining && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface text-[13px] text-text-muted">
          Joining the discussion room…
        </div>
      )}

      {leftCall && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-surface px-4 text-center">
          <p className="text-[13.5px] text-text-muted">You left the call.</p>
          <button
            type="button"
            onClick={rejoin}
            className="px-5 py-2.5 rounded-[9px] bg-ink text-white text-[13px] font-semibold hover:bg-ink-dark cursor-pointer"
          >
            Re-join
          </button>
        </div>
      )}

      {consentVisible && inCall && !leftCall && (
        <div className="absolute top-3 left-1/2 z-30 w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-[10px] border border-border bg-surface px-3 py-2.5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] text-text leading-snug">
              This discussion is recorded and transcribed for admissions review.
            </p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setConsentVisible(false)}
              className="shrink-0 text-[16px] leading-none text-text-muted hover:text-text cursor-pointer px-1"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {adapter && (
        <div className="h-full w-full" aria-hidden={stillJoining || leftCall}>
          <CallComposite
            adapter={adapter}
            formFactor="desktop"
            options={{
              callControls: { ...CANDIDATE_CALL_CONTROLS },
              surveyOptions: { disableSurvey: true },
              errorBar: true,
              joinCallOptions: { microphoneCheck: "skip" },
              notificationOptions: { hideAllNotifications: true },
            }}
          />
        </div>
      )}
    </div>
  );
}
