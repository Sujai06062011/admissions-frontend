"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  callForInterview,
  createAdminDecision,
  listAdminDecisions,
  listCandidates,
  listPreferenceMatchResults,
} from "@/lib/adminApi";
import { PROGRAM_ID, PROGRAM_LABEL } from "@/lib/adminConfig";
import {
  STAGE_BADGE_COLORS,
  STAGE_BADGE_LABELS,
  SCREENING_FIELD_NAMES,
  attachMatchResults,
  computeScoreBands,
  countByStage,
  reasonValue,
  searchCandidates,
  withRank,
  type CandidateWithMatch,
} from "@/lib/adminPipeline";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { StageTabs, type StageTabDef } from "@/components/admin/StageTabs";
import { ScoreGauge } from "@/components/admin/ScoreGauge";
import { Table, type TableColumn } from "@/components/admin/Table";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { CandidateDrawer } from "@/components/admin/CandidateDrawer";
import { ChevronDownIcon, SearchIcon } from "@/components/admin/icons";

type StageTabKey = "screening" | "campus_test" | "campus_interview" | "final_interview" | "offered";

type PendingAction =
  | { type: "move_to_campus"; candidate: CandidateWithMatch }
  | { type: "override"; candidate: CandidateWithMatch }
  | { type: "move_to_final"; candidate: CandidateWithMatch };

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function CandidateCell({
  candidate,
  isTopPick,
  isOverridden = false,
}: {
  candidate: CandidateWithMatch;
  isTopPick: boolean;
  isOverridden?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-ink-light/15 text-ink-light flex items-center justify-center text-[11px] font-bold shrink-0">
        {initials(candidate.applicant_name)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-text truncate">
            {candidate.applicant_name || "Unnamed applicant"}
          </span>
          {isTopPick && (
            <span className="text-[9.5px] font-bold uppercase tracking-wide bg-gold-soft text-gold rounded-full px-1.5 py-0.5 shrink-0">
              Top Pick
            </span>
          )}
          {isOverridden && <OverriddenBadge />}
        </div>
        <div className="text-[11px] text-text-muted truncate">
          {candidate.application_number ?? candidate.application_id.slice(0, 8).toUpperCase()}
        </div>
      </div>
    </div>
  );
}

function StageBadge({ candidate }: { candidate: CandidateWithMatch }) {
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-1 rounded-full ${STAGE_BADGE_COLORS[candidate.stage]}`}
    >
      {STAGE_BADGE_LABELS[candidate.stage]}
    </span>
  );
}

/** Small visual cue alongside the stage badge — the row's light-purple
 * background (see OVERRIDDEN_ROW_CLASS) already signals this, but a text
 * label keeps it legible for anyone relying on high-contrast/no-color
 * viewing and reads clearly in a screenshot or printout. */
function OverriddenBadge() {
  return (
    <span
      title="This candidate failed a hard-cutoff rule and was manually overridden into the pipeline."
      className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EEE3FB] text-[#7A4FC4]"
    >
      Overridden
    </span>
  );
}

const OVERRIDDEN_ROW_CLASS = "bg-[#F7F2FD]";

export default function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<StageTabKey>("screening");
  const [search, setSearch] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [rejectedExpanded, setRejectedExpanded] = useState(true);
  const [passedExpanded, setPassedExpanded] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const candidatesQuery = useQuery({
    queryKey: ["candidates", PROGRAM_ID],
    queryFn: () =>
      listCandidates({
        program_id: PROGRAM_ID,
        sort_by: "preference_match_score",
        order: "desc",
        limit: 500,
      }),
  });

  const matchResultsQuery = useQuery({
    queryKey: ["preference-match-results", PROGRAM_ID],
    queryFn: () => listPreferenceMatchResults({ program_id: PROGRAM_ID, limit: 500 }),
  });

  const overridesQuery = useQuery({
    queryKey: ["admin-decisions", PROGRAM_ID, "manual_override"],
    queryFn: () => listAdminDecisions({ program_id: PROGRAM_ID, decision: "manual_override" }),
  });

  const isLoading = candidatesQuery.isLoading || matchResultsQuery.isLoading;
  const isError = candidatesQuery.isError || matchResultsQuery.isError;

  const allCandidates = useMemo(() => {
    if (!candidatesQuery.data) return [];
    return attachMatchResults(candidatesQuery.data, matchResultsQuery.data ?? []);
  }, [candidatesQuery.data, matchResultsQuery.data]);

  const overriddenIds = useMemo(
    () => new Set((overridesQuery.data ?? []).map((d) => d.application_id)),
    [overridesQuery.data],
  );

  const filtered = useMemo(() => searchCandidates(allCandidates, search), [allCandidates, search]);
  const counts = useMemo(() => countByStage(allCandidates), [allCandidates]);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["candidates", PROGRAM_ID] });
    queryClient.invalidateQueries({ queryKey: ["preference-match-results", PROGRAM_ID] });
    queryClient.invalidateQueries({ queryKey: ["funnel", PROGRAM_ID] });
    queryClient.invalidateQueries({ queryKey: ["admin-decisions", PROGRAM_ID] });
  }

  const moveToCampusMutation = useMutation({
    mutationFn: (applicationId: string) =>
      createAdminDecision({ application_id: applicationId, stage: "stage2_move_to_campus", decision: "approved" }),
    onSuccess: () => {
      invalidateAll();
      setPendingAction(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const overrideMutation = useMutation({
    mutationFn: ({ applicationId, notes }: { applicationId: string; notes: string }) =>
      createAdminDecision({
        application_id: applicationId,
        stage: "stage2_move_to_campus",
        decision: "manual_override",
        notes,
      }),
    onSuccess: () => {
      invalidateAll();
      setPendingAction(null);
      setOverrideReason("");
    },
    onError: (err: Error) => setActionError(err.message),
  });

  // Two backend records (AdminDecision + FinalDecision) currently track this
  // transition independently and can desync the funnel's called_for_interview
  // count, so both are written together to keep them consistent.
  const moveToFinalMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      await createAdminDecision({
        application_id: applicationId,
        stage: "stage3_call_for_interview",
        decision: "approved",
      });
      await callForInterview([applicationId]);
    },
    onSuccess: () => {
      invalidateAll();
      setPendingAction(null);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const actionLoading =
    moveToCampusMutation.isPending || overrideMutation.isPending || moveToFinalMutation.isPending;

  const tabs: StageTabDef[] = [
    { key: "screening", label: "Screening", count: counts.screening },
    { key: "campus_test", label: "Campus Test", count: counts.campus_test },
    { key: "campus_interview", label: "Campus Interview", count: counts.campus_interview },
    { key: "final_interview", label: "Final Interview", count: counts.final_interview },
    { key: "offered", label: "Offered", count: counts.offered },
  ];

  const passedRows = withRank(filtered.filter((c) => c.stage !== "screening_rejected"));
  const rejectedRows = withRank(filtered.filter((c) => c.stage === "screening_rejected"));
  const passedScoreBands = computeScoreBands(passedRows.map((c) => c.preference_match_score));
  const rejectedScoreBands = computeScoreBands(rejectedRows.map((c) => c.preference_match_score));

  const stageRows =
    tab === "screening" ? [] : withRank(filtered.filter((c) => c.stage === tab));
  const stageScoreBands = computeScoreBands(stageRows.map((c) => c.preference_match_score));

  function confirmCopy(action: PendingAction) {
    const name = action.candidate.applicant_name || "this candidate";
    switch (action.type) {
      case "move_to_campus":
        return {
          title: "Move to Campus?",
          description: `${name} will be moved to the campus stage (Campus Test / Campus Interview).`,
          confirmLabel: "Move to Campus",
        };
      case "override":
        return {
          title: "Override screening rejection?",
          description: `${name} failed one or more hard-cutoff rules. Overriding moves them directly to the campus stage.`,
          confirmLabel: "Override & Accept",
        };
      case "move_to_final":
        return {
          title: "Move to Final Interview?",
          description: `${name} will be called for the final interview. This writes both the admin decision and the interview-call record.`,
          confirmLabel: "Move to Final Interview",
        };
    }
  }

  const passedColumns: TableColumn<CandidateWithMatch & { rank: number }>[] = [
    { key: "rank", header: "Rank", render: (c) => <span className="text-text-muted font-semibold">#{c.rank}</span> },
    {
      key: "candidate",
      header: "Candidate",
      render: (c) => (
        <CandidateCell candidate={c} isTopPick={c.rank === 1} isOverridden={overriddenIds.has(c.application_id)} />
      ),
    },
    {
      key: "composite",
      header: "Composite",
      render: (c) => (
        <ScoreGauge score={c.preference_match_score} band={passedScoreBands.get(c.preference_match_score) ?? "unscored"} />
      ),
    },
    {
      key: "tenth",
      header: "10th",
      render: (c) => reasonValue(c.reasons, SCREENING_FIELD_NAMES.tenthPercentage) ?? "—",
    },
    {
      key: "twelfth",
      header: "12th",
      render: (c) => reasonValue(c.reasons, SCREENING_FIELD_NAMES.twelfthPercentage) ?? "—",
    },
    {
      key: "ug",
      header: "UG",
      render: (c) => reasonValue(c.reasons, SCREENING_FIELD_NAMES.ugPercentage) ?? "—",
    },
    {
      key: "exp",
      header: "Exp",
      render: (c) => {
        const v = reasonValue(c.reasons, SCREENING_FIELD_NAMES.experienceYears);
        return v == null ? "—" : `${v}yr`;
      },
    },
    {
      key: "certs",
      header: "Certs",
      render: (c) => reasonValue(c.reasons, SCREENING_FIELD_NAMES.certificationsCount) ?? "—",
    },
    { key: "stage", header: "Stage", render: (c) => <StageBadge candidate={c} /> },
    {
      key: "action",
      header: "Action",
      className: "text-right",
      headerClassName: "text-right",
      render: (c) => {
        if (c.stage === "screening_passed") {
          return (
            <button
              type="button"
              onClick={() => setPendingAction({ type: "move_to_campus", candidate: c })}
              className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
            >
              Move to Campus Test
            </button>
          );
        }
        if (c.stage === "campus_test") {
          return <span className="text-[12px] text-text-muted">Awaiting Test A</span>;
        }
        if (c.stage === "campus_interview") {
          return (
            <button
              type="button"
              onClick={() => setPendingAction({ type: "move_to_final", candidate: c })}
              className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
            >
              Move to Final Interview
            </button>
          );
        }
        if (c.stage === "final_interview") {
          return (
            <span
              className="text-[12px] text-text-muted cursor-not-allowed"
              title="No backend endpoint writes status=offered yet."
            >
              Mark as Offered
            </span>
          );
        }
        return <span className="text-text-muted">—</span>;
      },
    },
  ];

  const rejectedColumns: TableColumn<CandidateWithMatch & { rank: number }>[] = [
    { key: "rank", header: "Rank", render: (c) => <span className="text-text-muted font-semibold">#{c.rank}</span> },
    {
      key: "candidate",
      header: "Candidate",
      render: (c) => <CandidateCell candidate={c} isTopPick={false} />,
    },
    {
      key: "composite",
      header: "Composite",
      render: (c) => (
        <ScoreGauge
          score={c.preference_match_score}
          band={rejectedScoreBands.get(c.preference_match_score) ?? "unscored"}
        />
      ),
    },
    {
      key: "tenth",
      header: "10th",
      render: (c) => reasonValue(c.reasons, SCREENING_FIELD_NAMES.tenthPercentage) ?? "—",
    },
    {
      key: "twelfth",
      header: "12th",
      render: (c) => reasonValue(c.reasons, SCREENING_FIELD_NAMES.twelfthPercentage) ?? "—",
    },
    {
      key: "ug",
      header: "UG",
      render: (c) => reasonValue(c.reasons, SCREENING_FIELD_NAMES.ugPercentage) ?? "—",
    },
    {
      key: "exp",
      header: "Exp",
      render: (c) => {
        const v = reasonValue(c.reasons, SCREENING_FIELD_NAMES.experienceYears);
        return v == null ? "—" : `${v}yr`;
      },
    },
    {
      key: "certs",
      header: "Certs",
      render: (c) => reasonValue(c.reasons, SCREENING_FIELD_NAMES.certificationsCount) ?? "—",
    },
    { key: "stage", header: "Stage", render: (c) => <StageBadge candidate={c} /> },
    {
      key: "action",
      header: "Action",
      className: "text-right",
      headerClassName: "text-right",
      render: (c) => (
        <button
          type="button"
          onClick={() => setPendingAction({ type: "override", candidate: c })}
          className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
        >
          Override &amp; Accept
        </button>
      ),
    },
  ];

  const stageColumns: TableColumn<CandidateWithMatch & { rank: number }>[] = [
    { key: "rank", header: "Rank", render: (c) => <span className="text-text-muted font-semibold">#{c.rank}</span> },
    {
      key: "candidate",
      header: "Candidate",
      render: (c) => (
        <CandidateCell candidate={c} isTopPick={c.rank === 1} isOverridden={overriddenIds.has(c.application_id)} />
      ),
    },
    {
      key: "composite",
      header: "Composite",
      render: (c) => (
        <ScoreGauge score={c.preference_match_score} band={stageScoreBands.get(c.preference_match_score) ?? "unscored"} />
      ),
    },
    {
      key: "tenth",
      header: "10th",
      render: (c) => reasonValue(c.reasons, SCREENING_FIELD_NAMES.tenthPercentage) ?? "—",
    },
    {
      key: "twelfth",
      header: "12th",
      render: (c) => reasonValue(c.reasons, SCREENING_FIELD_NAMES.twelfthPercentage) ?? "—",
    },
    {
      key: "ug",
      header: "UG",
      render: (c) => reasonValue(c.reasons, SCREENING_FIELD_NAMES.ugPercentage) ?? "—",
    },
    {
      key: "test_a",
      header: "Test A",
      render: (c) => (c.test_a_score == null ? "—" : Math.round(c.test_a_score)),
    },
    {
      key: "test_b",
      header: "Test B",
      render: (c) => (c.test_b_score == null ? "—" : Math.round(c.test_b_score)),
    },
    {
      key: "action",
      header: "Action",
      className: "text-right",
      headerClassName: "text-right",
      render: (c) => {
        if (tab === "campus_interview") {
          return (
            <button
              type="button"
              onClick={() => setPendingAction({ type: "move_to_final", candidate: c })}
              className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
            >
              Move to Final Interview
            </button>
          );
        }
        if (tab === "campus_test") {
          return <span className="text-[12px] text-text-muted">Awaiting Test A</span>;
        }
        if (tab === "final_interview") {
          return (
            <span
              className="text-[12px] text-text-muted cursor-not-allowed"
              title="No backend endpoint writes status=offered yet."
            >
              Mark as Offered
            </span>
          );
        }
        return <span className="text-text-muted">—</span>;
      },
    },
  ];

  const pendingCopy = pendingAction ? confirmCopy(pendingAction) : null;

  return (
    <div>
      <AdminTopbar
        title="Applications"
        subtitle={`${PROGRAM_LABEL} · ${allCandidates.length} total received`}
      >
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID..."
            className="pl-9 pr-3 py-2 border border-border rounded-lg text-[13px] w-64 bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15"
          />
        </div>
      </AdminTopbar>

      <div className="mb-5">
        <StageTabs tabs={tabs} active={tab} onChange={(k) => setTab(k as StageTabKey)} />
      </div>

      {actionError && (
        <div className="bg-brick-soft border border-brick/30 text-brick text-sm rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {isLoading && <div className="text-sm text-text-muted">Loading applications…</div>}
      {isError && (
        <div className="bg-brick-soft border border-brick/30 text-brick text-sm rounded-xl px-4 py-3">
          Couldn&apos;t load applications. The backend may be unreachable — try refreshing.
        </div>
      )}

      {!isLoading && !isError && tab === "screening" && (
        <div className="space-y-5">
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setPassedExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4"
            >
              <span className="flex items-center gap-2 font-serif font-bold text-text text-[15px]">
                <span className="text-forest">✓</span> Passed Screening
                <span className="text-text-muted text-[12.5px] font-sans font-normal">
                  {passedRows.length} candidates
                </span>
              </span>
              <ChevronDownIcon className={`w-4 h-4 text-text-muted transition ${passedExpanded ? "" : "-rotate-90"}`} />
            </button>
            {passedExpanded && (
              <Table
                columns={passedColumns}
                rows={passedRows}
                rowKey={(c) => c.application_id}
                emptyMessage="No candidates have passed screening yet."
                onRowClick={(c) => setDrawerId(c.application_id)}
                rowClassName={(c) => (overriddenIds.has(c.application_id) ? OVERRIDDEN_ROW_CLASS : "")}
              />
            )}
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setRejectedExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4"
            >
              <span className="flex items-center gap-2 font-serif font-bold text-text text-[15px]">
                <span className="text-brick">⊘</span> Rejected at Screening
                <span className="text-text-muted text-[12.5px] font-sans font-normal">
                  {rejectedRows.length} candidates
                </span>
              </span>
              <ChevronDownIcon className={`w-4 h-4 text-text-muted transition ${rejectedExpanded ? "" : "-rotate-90"}`} />
            </button>
            {rejectedExpanded && (
              <Table
                columns={rejectedColumns}
                rows={rejectedRows}
                rowKey={(c) => c.application_id}
                emptyMessage="No candidates rejected at screening."
                onRowClick={(c) => setDrawerId(c.application_id)}
              />
            )}
          </div>
        </div>
      )}

      {!isLoading && !isError && tab !== "screening" && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <Table
            columns={stageColumns}
            rows={stageRows}
            rowKey={(c) => c.application_id}
            emptyMessage="No candidates at this stage yet."
            onRowClick={(c) => setDrawerId(c.application_id)}
            rowClassName={(c) => (overriddenIds.has(c.application_id) ? OVERRIDDEN_ROW_CLASS : "")}
          />
        </div>
      )}

      <CandidateDrawer applicationId={drawerId} onClose={() => setDrawerId(null)} />

      {pendingAction && pendingCopy && (
        <ConfirmDialog
          open
          title={pendingCopy.title}
          description={pendingCopy.description}
          confirmLabel={pendingCopy.confirmLabel}
          loading={actionLoading}
          confirmDisabled={pendingAction.type === "override" && overrideReason.trim().length === 0}
          onCancel={() => {
            setPendingAction(null);
            setOverrideReason("");
          }}
          onConfirm={() => {
            const id = pendingAction.candidate.application_id;
            setActionError(null);
            if (pendingAction.type === "move_to_campus") moveToCampusMutation.mutate(id);
            if (pendingAction.type === "override")
              overrideMutation.mutate({ applicationId: id, notes: overrideReason.trim() });
            if (pendingAction.type === "move_to_final") moveToFinalMutation.mutate(id);
          }}
        >
          {pendingAction.type === "override" && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
                Reason for override <span className="text-brick">*</span>
              </label>
              <textarea
                autoFocus
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Strong prior work experience offsets a marginal 10th percentage."
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15 resize-none"
              />
              <p className="text-[11px] text-text-muted mt-1.5">
                Recorded against this candidate for audit purposes.
              </p>
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
