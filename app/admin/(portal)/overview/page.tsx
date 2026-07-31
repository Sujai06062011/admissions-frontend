"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  listAdminDecisions,
  listCandidates,
  listPreferenceMatchResults,
} from "@/lib/adminApi";
import { ADMISSIONS_CYCLE_LABEL, PROGRAM_ID, PROGRAM_LABEL } from "@/lib/adminConfig";
import { attachMatchResults, countByStage } from "@/lib/adminPipeline";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { StatCard } from "@/components/admin/StatCard";
import { FunnelBars, StageBreakdownList, type FunnelStage } from "@/components/admin/FunnelBars";
import { AlertIcon, AwardIcon, CheckCircleIcon, SlidersIcon, UsersIcon, XCircleIcon } from "@/components/admin/icons";

export default function OverviewPage() {
  const candidatesQuery = useQuery({
    queryKey: ["candidates", PROGRAM_ID],
    queryFn: () => listCandidates({ program_id: PROGRAM_ID, limit: 500 }),
  });
  const matchResultsQuery = useQuery({
    queryKey: ["preference-match-results", PROGRAM_ID],
    queryFn: () => listPreferenceMatchResults({ program_id: PROGRAM_ID }),
  });
  const decisionsQuery = useQuery({
    queryKey: ["admin-decisions", PROGRAM_ID, "manual_override"],
    queryFn: () => listAdminDecisions({ program_id: PROGRAM_ID, decision: "manual_override" }),
  });

  const overriddenIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of decisionsQuery.data ?? []) ids.add(d.application_id);
    return ids;
  }, [decisionsQuery.data]);

  const allCandidates = useMemo(() => {
    if (!candidatesQuery.data) return [];
    return attachMatchResults(candidatesQuery.data, matchResultsQuery.data ?? [], overriddenIds);
  }, [candidatesQuery.data, matchResultsQuery.data, overriddenIds]);

  const counts = useMemo(() => countByStage(allCandidates), [allCandidates]);
  const rejectedAtScreening = useMemo(
    () => allCandidates.filter((c) => c.stage === "screening_rejected").length,
    [allCandidates],
  );
  const passedScreening = allCandidates.length - rejectedAtScreening;
  const received = allCandidates.length;
  const passRate = received > 0 ? Math.round((passedScreening / received) * 100) : 0;
  const conversionRate = received > 0 ? Math.round((counts.offered / received) * 100) : 0;

  const stages: FunnelStage[] = [
    { key: "received", label: "Received", value: received },
    { key: "passed_screening", label: "Passed Screening", value: passedScreening },
    { key: "campus_test", label: "Campus Test", value: counts.campus_test },
    { key: "campus_interview", label: "Campus Interview", value: counts.campus_interview },
    { key: "final_interview", label: "Final Interview", value: counts.final_interview },
    { key: "offered", label: "Offered", value: counts.offered },
  ];

  const isLoading =
    candidatesQuery.isLoading || matchResultsQuery.isLoading || decisionsQuery.isLoading;
  const isError = candidatesQuery.isError || matchResultsQuery.isError || decisionsQuery.isError;

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
          Couldn&apos;t load overview data. The backend may be unreachable — try refreshing.
        </div>
      )}

      {isLoading && <div className="text-text-muted text-sm">Loading overview…</div>}

      {!isLoading && !isError && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<UsersIcon className="w-[18px] h-[18px]" />}
              iconBg="bg-ink-light/15"
              iconColor="text-ink-light"
              value={received}
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
              value={rejectedAtScreening}
              label="Rejected at Screening"
              caption="Hard reject / mismatch"
              captionColor="text-brick"
            />
            <StatCard
              icon={<AwardIcon className="w-[18px] h-[18px]" />}
              iconBg="bg-gold-soft"
              iconColor="text-gold"
              value={counts.offered}
              label="Offers Extended"
              caption={`${conversionRate}% conversion`}
              captionColor="text-gold"
            />
          </div>

          <div className="bg-surface border border-border rounded-xl p-5 mb-6">
            <div className="flex items-start justify-between mb-5 flex-wrap gap-2">
              <div>
                <h2 className="font-serif text-base font-bold text-text">Applicant Pipeline</h2>
                <p className="text-text-muted text-[12.5px] mt-0.5">
                  Current headcount by stage · same counts as Applications tabs · {received}{" "}
                  received
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
