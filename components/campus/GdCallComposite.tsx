"use client";

import { useCallback, useMemo } from "react";
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

/** Candidate controls only — no Hold / Captions / RTT / Phone / View menu. */
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
  raiseHandButton: false,
  reactionButton: false,
  devicesButton: true,
  dtmfDialerButton: false,
} as const;

export function GdCallComposite({
  acsUserId,
  acsToken,
  teamsJoinUrl,
  displayName,
  onPageChange,
}: Props) {
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

  const afterCreate = useCallback(
    async (adapter: CallAdapter) => {
      const emit = () => onPageChange?.(adapter.getState().page);
      emit();
      adapter.onStateChange((state) => onPageChange?.(state.page));

      // Skip ACS "Start call" / device setup screen — candidates auto-join the meeting.
      // Host Start (topic + timer) is a separate Admit admin action, not this button.
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch {
        // Permissions may still be granted later from in-call controls.
      }
      adapter.joinCall({ microphoneOn: true, cameraOn: true });

      return adapter;
    },
    [onPageChange],
  );

  const beforeDispose = useCallback(async (_adapter: CallAdapter) => {
    void _adapter;
  }, []);

  const adapter = useAzureCommunicationCallAdapter(adapterArgs, afterCreate, beforeDispose);

  if (!adapter) {
    return (
      <div className="rounded-[14px] border border-border bg-surface px-4 py-8 text-center text-[13px] text-text-muted">
        Joining the discussion…
      </div>
    );
  }

  return (
    <div className="gd-call-composite relative h-[min(72vh,640px)] w-full overflow-visible rounded-[14px] border border-border bg-[#111]">
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
      `}</style>
      <CallComposite
        adapter={adapter}
        formFactor="desktop"
        options={{
          callControls: { ...CANDIDATE_CALL_CONTROLS },
          surveyOptions: { disableSurvey: true },
          errorBar: true,
        }}
      />
    </div>
  );
}
