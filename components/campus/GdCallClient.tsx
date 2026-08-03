"use client";

import dynamic from "next/dynamic";
import type { CallCompositePage } from "@azure/communication-react";

const GdCallComposite = dynamic(
  () => import("./GdCallComposite").then((m) => m.GdCallComposite),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[14px] border border-border bg-surface px-4 py-8 text-center text-[13px] text-text-muted">
        Loading video…
      </div>
    ),
  },
);

type Props = {
  acsUserId: string;
  acsToken: string;
  teamsJoinUrl: string;
  displayName: string;
  onPageChange?: (page: CallCompositePage) => void;
};

/** Client-only ACS Call Composite wrapper (no SSR — Calling SDK needs the browser). */
export function GdCallClient(props: Props) {
  return <GdCallComposite {...props} />;
}
