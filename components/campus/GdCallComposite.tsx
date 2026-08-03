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

function forceJoin(adapter: CallAdapter) {
  try {
    adapter.joinCall({ microphoneOn: true, cameraOn: true });
  } catch {
    try {
      adapter.joinCall(true);
    } catch {
      // Composite may already be joining.
    }
  }
}

export function GdCallComposite({
  acsUserId,
  acsToken,
  teamsJoinUrl,
  displayName,
  onPageChange,
}: Props) {
  const [page, setPage] = useState<CallCompositePage | null>(null);
  const pageRef = useRef<CallCompositePage | null>(null);

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

  const afterCreate = useCallback(async (adapter: CallAdapter) => {
    // Skip ACS configuration / "Start call" — join as soon as the adapter exists.
    forceJoin(adapter);
    return adapter;
  }, []);

  const adapter = useAzureCommunicationCallAdapter(adapterArgs, afterCreate);

  useEffect(() => {
    if (!adapter) return;

    const onState = (state: { page: CallCompositePage }) => {
      pageRef.current = state.page;
      setPage(state.page);
      onPageChange?.(state.page);
    };

    onState(adapter.getState());
    adapter.onStateChange(onState);
    return () => adapter.offStateChange(onState);
  }, [adapter, onPageChange]);

  // Keep retrying join until we leave the configuration screen.
  useEffect(() => {
    if (!adapter) return;

    forceJoin(adapter);
    const id = window.setInterval(() => {
      if (pageRef.current === "configuration" || pageRef.current === null) {
        forceJoin(adapter);
      }
    }, 400);

    return () => window.clearInterval(id);
  }, [adapter]);

  const stillJoining = !adapter || page === null || page === "configuration";

  return (
    <div
      className="gd-call-composite relative h-[min(72vh,640px)] w-full overflow-hidden rounded-[14px] border border-border bg-[#111]"
      data-joining={stillJoining ? "true" : "false"}
    >
      <style>{`
        .gd-call-composite [data-ui-id="compliance-banner"],
        .gd-call-composite [class*="complianceBanner"],
        .gd-call-composite [class*="ComplianceBanner"] {
          z-index: 40 !important;
          pointer-events: auto !important;
        }
        .gd-call-composite [data-ui-id="compliance-banner"] button,
        .gd-call-composite [class*="complianceBanner"] button,
        .gd-call-composite [class*="ComplianceBanner"] button {
          display: inline-flex !important;
          min-width: 2rem;
          min-height: 2rem;
        }
        /* Hide ACS setup / Start call UI; we auto-join instead. */
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

      {adapter && (
        <div className="h-full w-full" aria-hidden={stillJoining}>
          <CallComposite
            adapter={adapter}
            formFactor="desktop"
            options={{
              callControls: { ...CANDIDATE_CALL_CONTROLS },
              surveyOptions: { disableSurvey: true },
              errorBar: true,
              joinCallOptions: { microphoneCheck: "skip" },
            }}
          />
        </div>
      )}
    </div>
  );
}
