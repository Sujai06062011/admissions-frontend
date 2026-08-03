"use client";

import { useMemo } from "react";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";
import {
  CallComposite,
  useAzureCommunicationCallAdapter,
} from "@azure/communication-react";
import "@fluentui/react/dist/css/fabric.min.css";

type Props = {
  acsUserId: string;
  acsToken: string;
  teamsJoinUrl: string;
  displayName: string;
};

export function GdCallComposite({
  acsUserId,
  acsToken,
  teamsJoinUrl,
  displayName,
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

  const adapter = useAzureCommunicationCallAdapter(adapterArgs);

  if (!adapter) {
    return (
      <div className="rounded-[14px] border border-border bg-surface px-4 py-8 text-center text-[13px] text-text-muted">
        Preparing camera and microphone…
      </div>
    );
  }

  return (
    <div className="h-[min(72vh,640px)] w-full overflow-hidden rounded-[14px] border border-border bg-[#111]">
      <CallComposite
        adapter={adapter}
        formFactor="desktop"
        options={{
          callControls: {
            cameraButton: true,
            microphoneButton: true,
            screenShareButton: false,
            peopleButton: true,
          },
        }}
      />
    </div>
  );
}
