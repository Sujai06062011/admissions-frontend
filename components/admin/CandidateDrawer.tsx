"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCandidate,
  getDocumentSignedUrl,
  getRecordingSignedUrl,
  getProctoringSnapshotSignedUrl,
} from "@/lib/adminApi";
import type { RubricScore, TabSwitchEvent } from "@/lib/adminTypes";
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

interface StoredNameMismatch {
  section_title: string;
  extracted_name: string;
  entered_name: string;
}

interface StoredEditedField {
  section_title: string;
  label: string;
  original: string;
  edited: string;
}

interface StoredDataMismatches {
  consented_at?: string;
  name_mismatches: StoredNameMismatch[];
  edited_fields: StoredEditedField[];
}

function parseDataMismatches(data: Record<string, unknown> | undefined): StoredDataMismatches | null {
  const raw = data?.data_mismatches;
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const nameMismatches = Array.isArray(obj.name_mismatches)
    ? (obj.name_mismatches as StoredNameMismatch[])
    : [];
  const editedFields = Array.isArray(obj.edited_fields)
    ? (obj.edited_fields as StoredEditedField[])
    : [];
  if (nameMismatches.length === 0 && editedFields.length === 0) return null;
  return {
    consented_at: typeof obj.consented_at === "string" ? obj.consented_at : undefined,
    name_mismatches: nameMismatches,
    edited_fields: editedFields,
  };
}

function AdminDiffRow({
  title,
  before,
  after,
  tone,
}: {
  title: string;
  before: string;
  after: string;
  tone: "brick" | "gold";
}) {
  const afterClasses =
    tone === "brick"
      ? "bg-brick-soft border-brick/30 text-brick"
      : "bg-gold-soft border-gold/30 text-gold";
  return (
    <div className="py-3 border-b border-border last:border-b-0">
      <div className="text-[10.5px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
        {title}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-1.5">
        <div className="min-w-0 rounded-md border border-border bg-[#F5FAFA] px-2.5 py-1.5">
          <div className="text-[9.5px] font-semibold text-text-muted mb-0.5">On documents</div>
          <div className="text-[12.5px] font-semibold break-words" title={before}>
            {before}
          </div>
        </div>
        <div className="flex items-center text-text-muted text-sm">→</div>
        <div className={`min-w-0 rounded-md border px-2.5 py-1.5 ${afterClasses}`}>
          <div className="text-[9.5px] font-semibold mb-0.5">Candidate entered</div>
          <div className="text-[12.5px] font-semibold text-text break-words" title={after}>
            {after}
          </div>
        </div>
      </div>
    </div>
  );
}

function summarizeTabSwitches(events: TabSwitchEvent[]): string {
  const switchCount = events.filter((e) => e.type === "hidden" || e.type === "blur").length;
  if (switchCount === 0) return "No tab-switching or window-focus loss detected.";
  const totalAwayMs = events.reduce((sum, e) => sum + (e.away_ms ?? 0), 0);
  const totalAwaySeconds = Math.round(totalAwayMs / 1000);
  return `${switchCount} tab-switch${switchCount === 1 ? "" : "es"} detected (~${totalAwaySeconds}s away total).`;
}

/** Lazily resolves signed URLs for a handful of private snapshot objects and
 * renders them as clickable thumbnails — fetched client-side rather than
 * server-side because signed URLs are short-lived and this drawer is opened
 * on demand, not pre-rendered. */
function SnapshotGallery({ applicationId, paths }: { applicationId: string; paths: string[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    // Deferred into a microtask (rather than calling setState synchronously
    // in the effect body) to satisfy react-hooks/set-state-in-effect —
    // matches the pattern already used in CampusSessionProvider.
    Promise.resolve().then(() => {
      if (!cancelled) setUrls({});
    });
    Promise.all(
      paths.map(async (path) => {
        try {
          const { url } = await getProctoringSnapshotSignedUrl(applicationId, path);
          return [path, url] as const;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const result of results) {
        if (result) next[result[0]] = result[1];
      }
      setUrls(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, paths.join(",")]);

  return (
    <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-border">
      {paths.map((path) => (
        <a
          key={path}
          href={urls[path] ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (!urls[path]) e.preventDefault();
          }}
          className="block aspect-video rounded-md overflow-hidden bg-border/40 cursor-pointer"
        >
          {urls[path] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={urls[path]}
              alt="Interview snapshot"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-text-muted">
              Loading…
            </div>
          )}
        </a>
      ))}
    </div>
  );
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

        {data && (() => {
          const dataMismatches = parseDataMismatches(data.profile_data?.data);
          return (
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
              {dataMismatches && (
                <span className="inline-block mt-2 ml-1.5 text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-gold-soft text-gold">
                  Mismatch
                </span>
              )}
              {data.test_b_session?.proctoring_review?.flagged && (
                <span className="inline-block mt-2 ml-1.5 text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-brick/10 text-brick">
                  Proctoring flagged
                </span>
              )}
            </div>

            {dataMismatches && (
              <section>
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                  What&apos;s different
                </h4>
                <div className="bg-bg rounded-lg px-3 py-2">
                  <p className="text-[11.5px] text-text-muted mb-1">
                    Candidate acknowledged these mismatches vs their documents before submitting.
                    {dataMismatches.consented_at
                      ? ` Consented ${formatDate(dataMismatches.consented_at)}.`
                      : ""}
                  </p>
                  {dataMismatches.name_mismatches.map((item, index) => (
                    <AdminDiffRow
                      key={`name-${index}`}
                      title={`${item.section_title} · Name on certificate`}
                      before={item.extracted_name}
                      after={item.entered_name}
                      tone="brick"
                    />
                  ))}
                  {dataMismatches.edited_fields.map((item, index) => (
                    <AdminDiffRow
                      key={`edit-${index}`}
                      title={`${item.section_title} · ${item.label}`}
                      before={item.original}
                      after={item.edited}
                      tone="gold"
                    />
                  ))}
                </div>
              </section>
            )}

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
                        <li key={r.field} className="flex items-center justify-between text-[12.5px] gap-3">
                          <span className="text-text-muted capitalize">{labelize(r.field)}</span>
                          <span
                            className={`font-semibold text-right ${
                              r.passed ? "text-forest" : "text-brick"
                            }`}
                          >
                            {r.actual ?? "—"}
                            {r.expected != null &&
                              r.field !== "test_a_score" &&
                              r.field !== "test_b_score" && (
                              <span className="text-text-muted font-normal">
                                {" "}
                                / min {r.expected}
                              </span>
                            )}
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

            {data.test_b_session &&
              (data.test_b_session.snapshot_urls?.length ||
                data.test_b_session.tab_switch_events?.length ||
                data.test_b_session.proctoring_review) && (
                <section>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                    Proctoring
                  </h4>
                  <div className="bg-bg rounded-lg p-3 text-[12.5px] space-y-2.5">
                    {data.test_b_session.proctoring_review ? (
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">Academic integrity</span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                            data.test_b_session.proctoring_review.flagged
                              ? "bg-brick/10 text-brick"
                              : "bg-forest/10 text-forest"
                          }`}
                        >
                          {data.test_b_session.proctoring_review.flagged
                            ? "Flagged"
                            : "No issues found"}
                        </span>
                      </div>
                    ) : (
                      data.test_b_session.snapshot_urls?.length ? (
                        <div className="text-text-muted">Snapshot review pending…</div>
                      ) : null
                    )}

                    {data.test_b_session.proctoring_review?.notes && (
                      <p className="text-text-muted italic leading-relaxed">
                        &ldquo;{data.test_b_session.proctoring_review.notes}&rdquo;
                      </p>
                    )}

                    {data.test_b_session.proctoring_review?.faces_per_snapshot &&
                      data.test_b_session.proctoring_review.faces_per_snapshot.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-text-muted">Faces per snapshot</span>
                          <span className="font-semibold text-text">
                            {data.test_b_session.proctoring_review.faces_per_snapshot.join(", ")}
                          </span>
                        </div>
                      )}

                    {data.test_b_session.snapshot_urls &&
                      data.test_b_session.snapshot_urls.length > 0 && (
                        <SnapshotGallery
                          applicationId={applicationId}
                          paths={data.test_b_session.snapshot_urls}
                        />
                      )}

                    <div className="pt-1.5 border-t border-border text-text-muted">
                      {data.test_b_session.tab_switch_events &&
                      data.test_b_session.tab_switch_events.length > 0
                        ? summarizeTabSwitches(data.test_b_session.tab_switch_events)
                        : "No tab-switching or window-focus loss detected."}
                    </div>
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
          );
        })()}
      </div>
    </div>
  );
}
