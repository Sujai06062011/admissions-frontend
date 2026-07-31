"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { callForInterview, listCandidates } from "@/lib/adminApi";
import { PROGRAM_ID, PROGRAM_LABEL } from "@/lib/adminConfig";
import { computeScoreBands, isReadyForInterviewCall, withRank } from "@/lib/adminPipeline";
import type { CallForInterviewResult } from "@/lib/adminTypes";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { ScoreGauge } from "@/components/admin/ScoreGauge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { PhoneIcon } from "@/components/admin/icons";

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function InterviewCallsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [results, setResults] = useState<CallForInterviewResult[] | null>(null);

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

  // Eligible = campus status + both Campus Test and Video Interview scores.
  // Shared with the sidebar badge via isReadyForInterviewCall.
  const eligible = useMemo(() => {
    const list = (candidatesQuery.data ?? []).filter(isReadyForInterviewCall);
    return withRank(list);
  }, [candidatesQuery.data]);

  const scoreBands = computeScoreBands(eligible.map((c) => c.preference_match_score));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === eligible.length ? new Set() : new Set(eligible.map((c) => c.application_id))));
  }

  const callMutation = useMutation({
    mutationFn: (applicationIds: string[]) => callForInterview(applicationIds),
    onSuccess: (data) => {
      setResults(data.results);
      setSelected(new Set());
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["candidates", PROGRAM_ID] });
      queryClient.invalidateQueries({ queryKey: ["funnel", PROGRAM_ID] });
    },
  });

  return (
    <div>
      <AdminTopbar
        title="Interview Calls"
        subtitle={`${PROGRAM_LABEL} · ${eligible.length} candidates ready for the final interview call`}
      >
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-2 bg-ink hover:bg-ink-dark text-white text-[13px] font-semibold rounded-lg px-4 py-2.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PhoneIcon className="w-4 h-4" />
          Call for Interview ({selected.size})
        </button>
      </AdminTopbar>

      {results && (
        <div className="bg-surface border border-border rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-serif text-sm font-bold text-text">Call Results</h3>
            <button type="button" onClick={() => setResults(null)} className="text-[12px] font-semibold text-text-muted hover:text-text">
              Dismiss
            </button>
          </div>
          <p className="text-[11.5px] text-text-muted mb-2.5">
            The backend doesn&apos;t persist a call-history log — this summary only reflects this
            batch&apos;s response and disappears on refresh.
          </p>
          <ul className="space-y-1">
            {results.map((r) => (
              <li key={r.application_id} className="flex items-center justify-between text-[12.5px]">
                <span className="text-text-muted">{r.application_id.slice(0, 8).toUpperCase()}</span>
                <span className={r.success ? "text-forest font-semibold" : "text-brick font-semibold"}>
                  {r.success ? "Called" : r.detail || "Failed"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidatesQuery.isLoading && <div className="text-sm text-text-muted">Loading candidates…</div>}
      {candidatesQuery.isError && (
        <div className="bg-brick-soft border border-brick/30 text-brick text-sm rounded-xl px-4 py-3">
          Couldn&apos;t load candidates.
        </div>
      )}

      {!candidatesQuery.isLoading && !candidatesQuery.isError && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {eligible.length === 0 ? (
            <div className="py-16 text-center text-text-muted text-sm">
              No candidates are ready for a final-interview call right now.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === eligible.length}
                      onChange={toggleAll}
                      className="w-4 h-4 accent-ink"
                    />
                  </th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted px-4 py-2.5">Rank</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted px-4 py-2.5">Candidate</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted px-4 py-2.5">Composite</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted px-4 py-2.5">Campus Test</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted px-4 py-2.5">Video Interview</th>
                </tr>
              </thead>
              <tbody>
                {eligible.map((c) => (
                  <tr
                    key={c.application_id}
                    onClick={() => toggle(c.application_id)}
                    className="border-b border-border last:border-0 hover:bg-bg/60 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(c.application_id)}
                        onChange={() => toggle(c.application_id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 accent-ink"
                      />
                    </td>
                    <td className="px-4 py-3 text-text-muted font-semibold">#{c.rank}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-ink-light/15 text-ink-light flex items-center justify-center text-[11px] font-bold shrink-0">
                          {initials(c.applicant_name)}
                        </div>
                        <span className="text-[13px] font-semibold text-text">
                          {c.applicant_name || "Unnamed applicant"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreGauge
                        score={c.preference_match_score}
                        band={scoreBands.get(c.preference_match_score) ?? "unscored"}
                      />
                    </td>
                    <td className="px-4 py-3">{c.test_a_score == null ? "—" : `${Math.round(c.test_a_score)}/100`}</td>
                    <td className="px-4 py-3">{c.test_b_score == null ? "—" : `${Math.round(c.test_b_score)}/100`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`Call ${selected.size} candidate${selected.size === 1 ? "" : "s"} for interview?`}
        description="This notifies each candidate and marks them as called for the final interview."
        confirmLabel="Call for Interview"
        loading={callMutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => callMutation.mutate(Array.from(selected))}
      />
    </div>
  );
}
