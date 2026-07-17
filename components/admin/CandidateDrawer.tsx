"use client";

import { useQuery } from "@tanstack/react-query";
import { getCandidate, getDocumentSignedUrl, getRecordingSignedUrl } from "@/lib/adminApi";
import type { RubricScore } from "@/lib/adminTypes";
import { CloseIcon } from "./icons";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/**
 * Mirrors normalized_test_b_score (admissions-backend/app/preferences/matching.py):
 * each rubric dimension is 0-10, so the average is scaled onto the same
 * 0-100 range Test A uses before either feeds into the composite score.
 */
function normalizedTestBScore(rubricScore: RubricScore): number | null {
  const values = Object.values(rubricScore).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10);
}

function labelize(value: string): string {
  return value.replace(/_/g, " ");
}

export function CandidateDrawer({
  applicationId,
  onClose,
}: {
  applicationId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["candidate", applicationId],
    queryFn: () => getCandidate(applicationId as string),
    enabled: !!applicationId,
  });

  if (!applicationId) return null;

  async function openDocument(documentId: string) {
    try {
      const { url } = await getDocumentSignedUrl(documentId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // Best-effort — signed URL generation failures aren't actionable here.
    }
  }

  async function openRecording() {
    try {
      const { url } = await getRecordingSignedUrl(applicationId as string);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // Best-effort.
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[440px] h-full bg-surface shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-serif text-base font-bold text-text">Candidate Detail</h3>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
            <CloseIcon />
          </button>
        </div>

        {isLoading && <div className="p-5 text-sm text-text-muted">Loading…</div>}
        {isError && (
          <div className="p-5 text-sm text-brick">Couldn&apos;t load candidate details.</div>
        )}

        {data && (
          <div className="p-5 space-y-6">
            <div>
              <div className="text-lg font-bold text-text">
                {data.applicant.full_name || "Unnamed applicant"}
              </div>
              <div className="text-[12.5px] text-text-muted mt-0.5">
                {data.application.application_number}
                {data.applicant.email ? ` · ${data.applicant.email}` : ""}
                {data.applicant.phone ? ` · ${data.applicant.phone}` : ""}
              </div>
              <span className="inline-block mt-2 text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-bg text-text-muted">
                {labelize(data.application.status)}
              </span>
            </div>

            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                Preference Match
              </h4>
              {data.preference_match ? (
                <div className="bg-bg rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-text-muted">Composite score</span>
                    <span className="font-bold text-text">
                      {data.preference_match.composite_score ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-text-muted">Hard-pass</span>
                    <span
                      className={`font-bold ${
                        data.preference_match.hard_pass ? "text-forest" : "text-brick"
                      }`}
                    >
                      {data.preference_match.hard_pass ? "Passed" : "Rejected"}
                    </span>
                  </div>
                  {data.preference_match.reasons.length > 0 && (
                    <ul className="space-y-1.5 border-t border-border pt-2.5">
                      {data.preference_match.reasons.map((r) => (
                        <li key={r.field} className="flex items-center justify-between text-[12.5px]">
                          <span className="text-text-muted capitalize">{labelize(r.field)}</span>
                          <span className={r.passed ? "text-forest font-semibold" : "text-brick font-semibold"}>
                            {r.actual ?? "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-[12.5px] text-text-muted">No match computed yet.</p>
              )}
            </section>

            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                Documents
              </h4>
              {data.documents.length === 0 ? (
                <p className="text-[12.5px] text-text-muted">No documents uploaded.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.documents.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => openDocument(doc.id)}
                      className="w-full flex items-center justify-between bg-bg hover:bg-border/40 rounded-lg px-3 py-2 text-left transition"
                    >
                      <span className="text-[12.5px] font-medium text-text capitalize">
                        {labelize(doc.doc_type)}
                      </span>
                      <span className="text-[11.5px] text-ink-light font-semibold">View →</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {data.campus_session && (
              <section>
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                  Campus Session
                </h4>
                <div className="bg-bg rounded-lg p-3 text-[12.5px] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Date</span>
                    <span className="font-semibold text-text">{data.campus_session.session_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Check-in</span>
                    <span className="font-semibold text-text">
                      {data.campus_session.check_in_status === "checked_in"
                        ? "Checked in"
                        : "Not checked in"}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {data.test_a_session && (
              <section>
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                  Test A · Written
                </h4>
                <div className="bg-bg rounded-lg p-3 text-[12.5px] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Score</span>
                    <span className="font-semibold text-text">{data.test_a_session.score ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Submitted</span>
                    <span className="font-semibold text-text">
                      {formatDate(data.test_a_session.submitted_at)}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {data.test_b_session && (
              <section>
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                  Test B · AI Interview
                </h4>
                <div className="bg-bg rounded-lg p-3 text-[12.5px] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Recorded</span>
                    <span className="font-semibold text-text">
                      {formatDate(data.test_b_session.recorded_at)}
                    </span>
                  </div>
                  {data.test_b_session.rubric_score && (
                    <>
                      <div className="flex justify-between pt-1.5 border-t border-border">
                        <span className="text-text-muted">Normalized score</span>
                        <span className="font-semibold text-text">
                          {normalizedTestBScore(data.test_b_session.rubric_score) ?? "—"} / 100
                        </span>
                      </div>
                      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1">
                        {Object.entries(data.test_b_session.rubric_score)
                          .filter(([, v]) => v != null)
                          .map(([dimension, value]) => (
                            <li key={dimension} className="flex justify-between">
                              <span className="text-text-muted capitalize">{dimension}</span>
                              <span className="font-semibold text-text">{value}/10</span>
                            </li>
                          ))}
                      </ul>
                    </>
                  )}
                  {data.test_b_session.rationale && (
                    <p className="text-text-muted italic pt-1.5 border-t border-border leading-relaxed">
                      &ldquo;{data.test_b_session.rationale}&rdquo;
                    </p>
                  )}
                  {data.test_b_session.recording_url && (
                    <button
                      type="button"
                      onClick={openRecording}
                      className="text-[11.5px] font-semibold text-ink-light"
                    >
                      Play Recording →
                    </button>
                  )}
                </div>
              </section>
            )}

            {data.admin_decisions.length > 0 && (
              <section>
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                  Decision History
                </h4>
                <div className="space-y-1.5">
                  {data.admin_decisions.map((d) => (
                    <div key={d.id} className="bg-bg rounded-lg px-3 py-2 text-[12.5px]">
                      <div className="flex justify-between font-semibold text-text">
                        <span className="capitalize">{labelize(d.stage)}</span>
                        <span className="capitalize">{labelize(d.decision)}</span>
                      </div>
                      <div className="text-text-muted mt-0.5">{formatDate(d.decided_at)}</div>
                      {d.notes && <div className="text-text-muted mt-0.5">{d.notes}</div>}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
