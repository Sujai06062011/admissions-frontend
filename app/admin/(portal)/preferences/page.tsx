"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listPreferenceConfigs, listPreferenceMatchResults, replacePreferenceConfigs } from "@/lib/adminApi";
import { PROGRAM_ID } from "@/lib/adminConfig";
import { simulateImpact, type HypotheticalPreferenceConfig } from "@/lib/adminMatching";
import type { PreferenceConfigResponse } from "@/lib/adminTypes";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface FieldDef {
  field_name: string;
  label: string;
  supportsHardCutoff: boolean;
  maxCutoff: number;
  unit: string;
}

const FIELD_DEFS: FieldDef[] = [
  { field_name: "10th_percentage", label: "10th Percentage", supportsHardCutoff: true, maxCutoff: 100, unit: "%" },
  { field_name: "12th_percentage", label: "12th Percentage", supportsHardCutoff: true, maxCutoff: 100, unit: "%" },
  { field_name: "experience_years", label: "Professional Experience", supportsHardCutoff: true, maxCutoff: 15, unit: "yr" },
  { field_name: "certifications_count", label: "Certifications & Courses", supportsHardCutoff: true, maxCutoff: 10, unit: "" },
  { field_name: "test_a_score", label: "Campus Test — Test A", supportsHardCutoff: false, maxCutoff: 100, unit: "" },
  { field_name: "test_b_score", label: "AI Video Interview — Test B", supportsHardCutoff: false, maxCutoff: 100, unit: "" },
];

interface FieldState {
  field_name: string;
  is_hard_cutoff: boolean;
  cutoff_value: number;
  /** Display units — a 0-100 percentage, e.g. 30 means "30% weight". */
  soft_weight: number;
}

/**
 * The backend (app/preferences/matching.py) treats PreferenceConfig.soft_weight
 * as a fraction of 1.0 — composite_score = Σ soft_weight * actual, and the
 * seeded defaults (0.3 / 0.3 / 0.4) sum to 1.0 for "100%". This page's
 * sliders work in human 0-100 percentage units for display, so every value
 * crossing the API boundary must be scaled by 100 to convert between the two.
 */
function toStoredWeight(displayPercent: number): number {
  return displayPercent / 100;
}

function fieldStatesFromConfigs(configs: PreferenceConfigResponse[]): FieldState[] {
  return FIELD_DEFS.map((def) => {
    const existing = configs.find((c) => c.field_name === def.field_name);
    return {
      field_name: def.field_name,
      is_hard_cutoff: existing?.is_hard_cutoff ?? false,
      cutoff_value: existing?.cutoff_value ?? 0,
      soft_weight: (existing?.soft_weight ?? 0) * 100,
    };
  });
}

export default function PreferencesPage() {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<FieldState[]>(fieldStatesFromConfigs([]));
  // Tracks which loaded config snapshot `fields` was seeded from, so the
  // one-time sync from server data into locally-editable slider state can
  // happen during render (React's documented escape hatch for this) instead
  // of inside an effect.
  const [syncedFrom, setSyncedFrom] = useState<PreferenceConfigResponse[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const configsQuery = useQuery({
    queryKey: ["preference-configs", PROGRAM_ID],
    queryFn: () => listPreferenceConfigs(PROGRAM_ID),
  });

  const matchResultsQuery = useQuery({
    queryKey: ["preference-match-results", PROGRAM_ID],
    queryFn: () => listPreferenceMatchResults({ program_id: PROGRAM_ID, limit: 500 }),
  });

  const hasExistingConfig = (configsQuery.data?.length ?? 0) > 0;
  const applicationCount = matchResultsQuery.data?.length ?? 0;

  if (configsQuery.data && syncedFrom === null) {
    setFields(fieldStatesFromConfigs(configsQuery.data));
    setSyncedFrom(configsQuery.data);
  }

  function updateField(fieldName: string, patch: Partial<FieldState>) {
    setFields((prev) => prev.map((f) => (f.field_name === fieldName ? { ...f, ...patch } : f)));
  }

  function resetFields() {
    setFields(fieldStatesFromConfigs(configsQuery.data ?? []));
  }

  const totalWeight = fields.reduce((sum, f) => sum + (f.soft_weight || 0), 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const toSave = fields.filter((f) => f.is_hard_cutoff || f.soft_weight > 0);
      return replacePreferenceConfigs(
        PROGRAM_ID,
        toSave.map((f) => ({
          field_name: f.field_name,
          is_hard_cutoff: f.is_hard_cutoff,
          cutoff_value: f.is_hard_cutoff ? f.cutoff_value : null,
          soft_weight: toStoredWeight(f.soft_weight),
        })),
      );
    },
    onSuccess: (savedConfigs) => {
      setConfirmOpen(false);
      // Sync sliders straight from what the backend just confirmed it saved,
      // rather than relying on a query refetch — invalidateQueries only
      // schedules a refetch, so reading configsQuery.data synchronously here
      // could still be the pre-save cached value and re-display stale
      // cutoffs/weights.
      queryClient.setQueryData(["preference-configs", PROGRAM_ID], savedConfigs);
      setFields(fieldStatesFromConfigs(savedConfigs));
      setSyncedFrom(savedConfigs);
      queryClient.invalidateQueries({ queryKey: ["preference-match-results"] });
    },
  });

  const candidateReasons = useMemo(
    () =>
      (matchResultsQuery.data ?? []).map((item) => ({
        application_id: item.application.id,
        reasons: item.match_result?.reasons ?? [],
      })),
    [matchResultsQuery.data],
  );

  const hypotheticalConfigs: HypotheticalPreferenceConfig[] = fields
    .filter((f) => f.is_hard_cutoff || f.soft_weight > 0)
    .map((f) => ({
      field_name: f.field_name,
      is_hard_cutoff: f.is_hard_cutoff,
      cutoff_value: f.is_hard_cutoff ? f.cutoff_value : null,
      soft_weight: toStoredWeight(f.soft_weight),
    }));

  const impact = simulateImpact(candidateReasons, hypotheticalConfigs);
  const isLoading = configsQuery.isLoading || matchResultsQuery.isLoading;

  return (
    <div>
      <AdminTopbar
        title="Screening Preferences"
        subtitle="Configure hard-filter rules and composite scoring weights for this cycle"
      >
        <button
          type="button"
          onClick={resetFields}
          className="text-[13px] font-semibold text-text-muted hover:text-text px-3 py-2.5"
        >
          Reset Defaults
        </button>
        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-2 bg-ink hover:bg-ink-dark text-white text-[13px] font-semibold rounded-lg px-4 py-2.5 transition disabled:opacity-60"
        >
          {saveMutation.isPending ? "Saving…" : "✓ Save Preferences"}
        </button>
      </AdminTopbar>

      {hasExistingConfig && (
        <div className="bg-gold-soft border border-gold/30 text-[13px] text-text rounded-xl px-4 py-3 mb-6">
          Saving replaces every rule below for this program and immediately re-scores all{" "}
          {applicationCount} existing application{applicationCount === 1 ? "" : "s"} against the
          new weights — there&apos;s no per-field edit on the backend, so a save is an atomic
          delete-and-recreate of the whole config set, not an incremental change.
        </div>
      )}

      {saveMutation.isError && (
        <div className="bg-brick-soft border border-brick/30 text-brick text-sm rounded-xl px-4 py-3 mb-6">
          {(saveMutation.error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-text-muted">Loading preferences…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-serif text-base font-bold text-text">Hard Filter Rules</h2>
              <p className="text-[12.5px] text-text-muted mt-1 mb-5">
                Applicants failing any enabled rule are automatically rejected during screening.
              </p>
              <div className="space-y-5">
                {FIELD_DEFS.filter((f) => f.supportsHardCutoff).map((def) => {
                  const state = fields.find((f) => f.field_name === def.field_name)!;
                  return (
                    <div key={def.field_name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[13px] font-semibold text-text">Minimum {def.label}</span>
                        <span className="text-[13px] font-bold text-ink">
                          {state.cutoff_value}
                          {def.unit}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={def.maxCutoff}
                        value={state.cutoff_value}
                        onChange={(e) =>
                          updateField(def.field_name, { cutoff_value: Number(e.target.value), is_hard_cutoff: true })
                        }
                        className="w-full accent-ink"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-serif text-base font-bold text-text">Composite Score Weights</h2>
              <p className="text-[12.5px] text-text-muted mt-1 mb-5">
                Each factor&apos;s contribution to the final composite ranking score.
              </p>
              <div className="space-y-5">
                {FIELD_DEFS.map((def) => {
                  const state = fields.find((f) => f.field_name === def.field_name)!;
                  return (
                    <div key={def.field_name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[13px] font-semibold text-text">{def.label}</span>
                        <span className="text-[13px] font-bold text-gold">{state.soft_weight}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={state.soft_weight}
                        onChange={(e) => updateField(def.field_name, { soft_weight: Number(e.target.value) })}
                        className="w-full accent-gold"
                      />
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-2 border-t border-border text-[13px] font-bold">
                  <span className="text-text">Total Weight</span>
                  <span className={totalWeight === 100 ? "text-forest" : "text-brick"}>{totalWeight}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="font-serif text-base font-bold text-text mb-1">
              Impact Preview — Current Applicant Pool
            </h2>
            <p className="text-[12.5px] text-text-muted mb-4">
              Preview only — recomputed live from currently loaded candidates, never saved to the
              backend.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-forest-soft rounded-xl px-4 py-3.5">
                <div className="text-2xl font-bold text-forest">{impact.wouldPassCount}</div>
                <div className="text-[12px] text-forest/80 mt-0.5">Would Pass Screening</div>
              </div>
              <div className="bg-brick-soft rounded-xl px-4 py-3.5">
                <div className="text-2xl font-bold text-brick">{impact.wouldRejectCount}</div>
                <div className="text-[12px] text-brick/80 mt-0.5">Would Be Rejected</div>
              </div>
              <div className="bg-ink-light/10 rounded-xl px-4 py-3.5">
                <div className="text-2xl font-bold text-ink-light">
                  {Math.round(impact.passRate * 100)}%
                </div>
                <div className="text-[12px] text-ink-light/80 mt-0.5">Pass Rate</div>
              </div>
              <div className="bg-gold-soft rounded-xl px-4 py-3.5">
                <div className="text-2xl font-bold text-gold">{impact.averageCompositeScore.toFixed(1)}</div>
                <div className="text-[12px] text-gold/80 mt-0.5">Avg Composite Score</div>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Save screening preferences?"
        description={`This replaces the current rules and immediately re-scores all ${applicationCount} existing application${applicationCount === 1 ? "" : "s"} in this program against the new weights.`}
        confirmLabel="Save & Re-score"
        loading={saveMutation.isPending}
        onConfirm={() => saveMutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
