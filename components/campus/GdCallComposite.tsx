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

const CANDIDATE_CALL_CONTROLS = {
  cameraButton: true,
  microphoneButton: true,
  screenShareButton: false,
  peopleButton: true,
  // Hide the overflow menu (Hold, Captions, RTT, Phone, View, etc.)
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
      return adapter;
    },
    [onPageChange],
  );

  const beforeDispose = useCallback(async (adapter: CallAdapter) => {
    // no-op — hook cleans up; keep signature for dispose ordering
    void adapter;
  }, []);

  const adapter = useAzureCommunicationCallAdapter(adapterArgs, afterCreate, beforeDispose);

  if (!adapter) {
    return (
      <div className="rounded-[14px] border border-border bg-surface px-4 py-8 text-center text-[13px] text-text-muted">
        Preparing camera and microphone…
      </div>
    );
  }

  return (
    <div className="gd-call-composite relative h-[min(72vh,640px)] w-full overflow-visible rounded-[14px] border border-border bg-[#111]">
      {/* Compliance banner must stay clickable — do not clip with overflow:hidden */}
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
