"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getFunnel } from "@/lib/adminApi";
import { ADMISSIONS_CYCLE_LABEL, PROGRAM_ID, PROGRAM_LABEL } from "@/lib/adminConfig";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { StatCard } from "@/components/admin/StatCard";
import { FunnelBars, StageBreakdownList, type FunnelStage } from "@/components/admin/FunnelBars";
import { AlertIcon, AwardIcon, CheckCircleIcon, SlidersIcon, UsersIcon, XCircleIcon } from "@/components/admin/icons";

export default function OverviewPage() {
  const { data: funnel, isLoading, isError } = useQuery({
    queryKey: ["funnel", PROGRAM_ID],
    queryFn: () => getFunnel(PROGRAM_ID),
  });

  const passedScreening = funnel ? funnel.received - funnel.rejected_on_preference_match : 0;
  const passRate = funnel && funnel.received > 0 ? Math.round((passedScreening / funnel.received) * 100) : 0;
  const conversionRate =
    funnel && funnel.received > 0 ? Math.round((funnel.offered / funnel.received) * 100) : 0;

  const stages: FunnelStage[] = funnel
    ? [
        { key: "received", label: "Received", value: funnel.received },
        { key: "passed_screening", label: "Passed Screening", value: passedScreening },
        { key: "campus_test", label: "Campus Test", value: funnel.test_a_complete },
        { key: "campus_interview", label: "Campus Interview", value: funnel.test_b_complete },
        { key: "final_interview", label: "Final Interview", value: funnel.called_for_interview },
        { key: "offered", label: "Offered", value: funnel.offered },
      ]
    : [];

  return (
    <div>
      <AdminTopbar title="Overview" subtitle={`${PROGRAM_LABEL} · ${ADMISSIONS_CYCLE_LABEL}`}>
        <Link
          href="/admin/preferences"
          className="flex items-center gap-2 bg-ink hover:bg-ink-dark text-white text-[13px] font-semibold rounded-lg px-4 py-2.5 transition"
        >
          <SlidersIcon className="w-4 h-4" />
          Configure Preferences
        </Link>
      </AdminTopbar>

      {isError && (
        <div className="bg-brick-soft border border-brick/30 text-brick text-sm rounded-xl px-4 py-3 mb-6">
          Couldn&apos;t load the funnel data. The backend may be unreachable — try refreshing.
        </div>
      )}

      {isLoading && <div className="text-text-muted text-sm">Loading overview…</div>}

      {funnel && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<UsersIcon className="w-[18px] h-[18px]" />}
              iconBg="bg-ink-light/15"
              iconColor="text-ink-light"
              value={funnel.received}
              label="Total Applications"
              caption="All-time total"
            />
            <StatCard
              icon={<CheckCircleIcon className="w-[18px] h-[18px]" />}
              iconBg="bg-forest-soft"
              iconColor="text-forest"
              value={passedScreening}
              label="Passed Screening"
              caption={`${passRate}% pass rate`}
              captionColor="text-forest"
            />
            <StatCard
              icon={<XCircleIcon className="w-[18px] h-[18px]" />}
              iconBg="bg-brick-soft"
              iconColor="text-brick"
              value={funnel.rejected_on_preference_match}
              label="Rejected at Screening"
              caption="Hard reject / mismatch"
              captionColor="text-brick"
            />
            <StatCard
              icon={<AwardIcon className="w-[18px] h-[18px]" />}
              iconBg="bg-gold-soft"
              iconColor="text-gold"
              value={funnel.offered}
              label="Offers Extended"
              caption={`${conversionRate}% conversion`}
              captionColor="text-gold"
            />
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 mb-6">
            <div className="flex items-start justify-between mb-5 flex-wrap gap-2">
              <div>
                <h2 className="font-serif text-base font-bold text-text">Applicant Pipeline Funnel</h2>
                <p className="text-text-muted text-[12.5px] mt-0.5">
                  Stage-by-stage conversion · {funnel.received} applications received
                </p>
              </div>
              <Link
                href="/admin/applications"
                className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
              >
                View All Applications →
              </Link>
            </div>
            <FunnelBars stages={stages} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-serif text-base font-bold text-text mb-4">Stage Breakdown</h2>
              <StageBreakdownList stages={stages} />
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-serif text-base font-bold text-text mb-4">Recent Activity</h2>
              <div className="flex flex-col items-center justify-center text-center py-10 text-text-muted">
                <AlertIcon className="w-7 h-7 mb-3 text-border" />
                <p className="text-sm font-medium text-text">No activity feed available</p>
                <p className="text-[12.5px] mt-1 max-w-[240px]">
                  The backend doesn&apos;t expose an events/notifications endpoint yet, so this is
                  shown honestly empty rather than fabricated.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
