"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bulkUploadQuestions,
  createQuestion,
  createQuestionBank,
  createTestBlueprint,
  deleteQuestion,
  deleteQuestionBank,
  deleteTestBlueprint,
  listQuestionBanks,
  listQuestions,
  listTestBlueprints,
  updateQuestion,
  updateQuestionBank,
  updateTestBlueprint,
} from "@/lib/adminApi";
import { PROGRAM_ID, PROGRAM_LABEL } from "@/lib/adminConfig";
import type {
  BulkUploadResult,
  QuestionBankResponse,
  QuestionCategory,
  QuestionResponse,
  TestBlueprintResponse,
} from "@/lib/adminTypes";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Table, type TableColumn } from "@/components/admin/Table";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { PlusIcon, TrashIcon } from "@/components/admin/icons";

const CATEGORIES: { value: QuestionCategory; label: string }[] = [
  { value: "quant", label: "Quantitative" },
  { value: "verbal", label: "Verbal" },
  { value: "logical_reasoning", label: "Logical Reasoning" },
  { value: "english_grammar", label: "English Grammar" },
  { value: "reading_comp", label: "Reading Comprehension" },
];

function categoryLabel(cat: string): string {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

interface QuestionFormState {
  id: string | null;
  category: QuestionCategory;
  question_text: string;
  optionsText: string;
  correct_answer: string;
  difficulty: string;
}

interface BlueprintFormState {
  id: string | null;
  category: QuestionCategory;
  question_count: string;
  duration_minutes: string;
  pass_threshold: string;
}

export default function QuestionBankPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [explicitBankId, setSelectedBankId] = useState<string | null>(null);
  const [bankForm, setBankForm] = useState<{ id: string | null; name: string } | null>(null);
  const [deleteBankTarget, setDeleteBankTarget] = useState<QuestionBankResponse | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<QuestionCategory | "">("");
  const [questionForm, setQuestionForm] = useState<QuestionFormState | null>(null);
  const [deleteQuestionTarget, setDeleteQuestionTarget] = useState<QuestionResponse | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null);
  const [blueprintForm, setBlueprintForm] = useState<BlueprintFormState | null>(null);
  const [deleteBlueprintTarget, setDeleteBlueprintTarget] = useState<TestBlueprintResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const banksQuery = useQuery({
    queryKey: ["question-banks", PROGRAM_ID],
    queryFn: () => listQuestionBanks(PROGRAM_ID),
  });

  // Falls back to the first bank once loaded, without needing an effect —
  // an explicit user selection (if any) always wins.
  const selectedBankId = explicitBankId ?? banksQuery.data?.[0]?.id ?? null;

  const questionsQuery = useQuery({
    queryKey: ["questions", selectedBankId, categoryFilter],
    queryFn: () => listQuestions(selectedBankId as string, categoryFilter || undefined),
    enabled: !!selectedBankId,
  });

  const blueprintsQuery = useQuery({
    queryKey: ["test-blueprints", PROGRAM_ID],
    queryFn: () => listTestBlueprints(PROGRAM_ID),
  });

  function invalidateBanks() {
    queryClient.invalidateQueries({ queryKey: ["question-banks", PROGRAM_ID] });
  }
  function invalidateQuestions() {
    queryClient.invalidateQueries({ queryKey: ["questions", selectedBankId, categoryFilter] });
  }
  function invalidateBlueprints() {
    queryClient.invalidateQueries({ queryKey: ["test-blueprints", PROGRAM_ID] });
  }

  const saveBankMutation = useMutation({
    mutationFn: (input: { id: string | null; name: string }) =>
      input.id ? updateQuestionBank(input.id, input.name) : createQuestionBank(PROGRAM_ID, input.name),
    onSuccess: (bank) => {
      invalidateBanks();
      setBankForm(null);
      setSelectedBankId(bank.id);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteBankMutation = useMutation({
    mutationFn: (bankId: string) => deleteQuestionBank(bankId),
    onSuccess: () => {
      invalidateBanks();
      setDeleteBankTarget(null);
      setSelectedBankId(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const saveQuestionMutation = useMutation({
    mutationFn: (input: QuestionFormState) => {
      const options = input.optionsText
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean);
      const payload = {
        category: input.category,
        question_text: input.question_text,
        options: options.length > 0 ? options : null,
        correct_answer: input.correct_answer || null,
        difficulty: input.difficulty || "medium",
      };
      return input.id ? updateQuestion(input.id, payload) : createQuestion(selectedBankId as string, payload);
    },
    onSuccess: () => {
      invalidateQuestions();
      setQuestionForm(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) => deleteQuestion(questionId),
    onSuccess: () => {
      invalidateQuestions();
      setDeleteQuestionTarget(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const bulkUploadMutation = useMutation({
    mutationFn: (file: File) => bulkUploadQuestions(selectedBankId as string, file),
    onSuccess: (result) => {
      invalidateQuestions();
      setBulkResult(result);
    },
    onError: (err: Error) => setError(err.message),
  });

  const saveBlueprintMutation = useMutation({
    mutationFn: (input: BlueprintFormState) => {
      const payload = {
        category: input.category,
        question_count: Number(input.question_count),
        duration_minutes: Number(input.duration_minutes),
        pass_threshold: input.pass_threshold ? Number(input.pass_threshold) : null,
      };
      return input.id ? updateTestBlueprint(input.id, payload) : createTestBlueprint(PROGRAM_ID, payload);
    },
    onSuccess: () => {
      invalidateBlueprints();
      setBlueprintForm(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteBlueprintMutation = useMutation({
    mutationFn: (blueprintId: string) => deleteTestBlueprint(blueprintId),
    onSuccess: () => {
      invalidateBlueprints();
      setDeleteBlueprintTarget(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const selectedBank = banksQuery.data?.find((b) => b.id === selectedBankId) ?? null;

  const questionColumns: TableColumn<QuestionResponse>[] = [
    { key: "category", header: "Category", render: (q) => categoryLabel(q.category) },
    {
      key: "question",
      header: "Question",
      className: "max-w-[320px]",
      render: (q) => <span className="truncate block">{q.question_text}</span>,
    },
    { key: "options", header: "Options", render: (q) => (q.options?.length ? q.options.length : "—") },
    { key: "answer", header: "Correct Answer", render: (q) => q.correct_answer || "—" },
    {
      key: "difficulty",
      header: "Difficulty",
      render: (q) => <span className="capitalize">{q.difficulty || "—"}</span>,
    },
    {
      key: "action",
      header: "Action",
      className: "text-right",
      headerClassName: "text-right",
      render: (q) => (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() =>
              setQuestionForm({
                id: q.id,
                category: q.category,
                question_text: q.question_text,
                optionsText: (q.options ?? []).join("\n"),
                correct_answer: q.correct_answer ?? "",
                difficulty: q.difficulty ?? "medium",
              })
            }
            className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
          >
            Edit
          </button>
          <button type="button" onClick={() => setDeleteQuestionTarget(q)} className="text-text-muted hover:text-brick">
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const blueprintColumns: TableColumn<TestBlueprintResponse>[] = [
    { key: "category", header: "Category", render: (b) => categoryLabel(b.category) },
    { key: "count", header: "Questions", render: (b) => b.question_count },
    { key: "duration", header: "Duration", render: (b) => `${b.duration_minutes} min` },
    { key: "threshold", header: "Pass Threshold", render: (b) => (b.pass_threshold != null ? b.pass_threshold : "—") },
    {
      key: "action",
      header: "Action",
      className: "text-right",
      headerClassName: "text-right",
      render: (b) => (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() =>
              setBlueprintForm({
                id: b.id,
                category: b.category,
                question_count: String(b.question_count),
                duration_minutes: String(b.duration_minutes),
                pass_threshold: b.pass_threshold != null ? String(b.pass_threshold) : "",
              })
            }
            className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
          >
            Edit
          </button>
          <button type="button" onClick={() => setDeleteBlueprintTarget(b)} className="text-text-muted hover:text-brick">
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <AdminTopbar title="Question Bank" subtitle={`${PROGRAM_LABEL} · Test A written question banks`}>
        <button
          type="button"
          onClick={() => setBankForm({ id: null, name: "" })}
          className="flex items-center gap-2 bg-ink hover:bg-ink-dark text-white text-[13px] font-semibold rounded-lg px-4 py-2.5 transition"
        >
          <PlusIcon className="w-4 h-4" />
          New Bank
        </button>
      </AdminTopbar>

      {error && (
        <div className="bg-brick-soft border border-brick/30 text-brick text-sm rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          {error}
          <button type="button" onClick={() => setError(null)} className="font-semibold">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        <div className="bg-surface border border-border rounded-xl p-3 h-fit">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted px-2 mb-2">
            Banks
          </div>
          {banksQuery.isLoading && <div className="text-[12.5px] text-text-muted px-2">Loading…</div>}
          {banksQuery.data?.length === 0 && (
            <div className="text-[12.5px] text-text-muted px-2">No banks yet.</div>
          )}
          <div className="space-y-1">
            {banksQuery.data?.map((bank) => (
              <button
                key={bank.id}
                type="button"
                onClick={() => setSelectedBankId(bank.id)}
                className={`w-full text-left rounded-lg px-3 py-2 text-[13px] font-medium transition group ${
                  bank.id === selectedBankId ? "bg-ink text-white" : "text-text hover:bg-bg"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{bank.name}</span>
                </div>
              </button>
            ))}
          </div>
          {selectedBank && (
            <div className="flex items-center gap-3 px-3 mt-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setBankForm({ id: selectedBank.id, name: selectedBank.name })}
                className="text-[11.5px] font-semibold text-ink-light hover:text-ink"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => setDeleteBankTarget(selectedBank)}
                className="text-[11.5px] font-semibold text-brick hover:text-brick/80"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 flex-wrap gap-3">
              <div>
                <h2 className="font-serif text-base font-bold text-text">
                  {selectedBank ? selectedBank.name : "Select a bank"}
                </h2>
                <p className="text-[12.5px] text-text-muted mt-0.5">
                  {questionsQuery.data?.length ?? 0} questions
                </p>
              </div>
              {selectedBank && (
                <div className="flex items-center gap-2.5">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as QuestionCategory | "")}
                    className="border border-border rounded-lg text-[12.5px] px-2.5 py-2 bg-surface"
                  >
                    <option value="">All categories</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) bulkUploadMutation.mutate(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={bulkUploadMutation.isPending}
                    className="text-[12.5px] font-semibold border border-border rounded-lg px-3 py-2 text-text hover:bg-bg transition disabled:opacity-60"
                  >
                    {bulkUploadMutation.isPending ? "Uploading…" : "Bulk Upload CSV"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQuestionForm({
                        id: null,
                        category: "quant",
                        question_text: "",
                        optionsText: "",
                        correct_answer: "",
                        difficulty: "medium",
                      })
                    }
                    className="flex items-center gap-1.5 bg-ink hover:bg-ink-dark text-white text-[12.5px] font-semibold rounded-lg px-3 py-2 transition"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Add Question
                  </button>
                </div>
              )}
            </div>

            {bulkResult && (
              <div className="px-5 pb-4">
                <div className="bg-forest-soft text-forest text-[12.5px] rounded-lg px-3 py-2 flex items-center justify-between">
                  <span>
                    Imported {bulkResult.created_count} questions
                    {bulkResult.errors.length > 0 ? `, ${bulkResult.errors.length} rows skipped` : ""}.
                  </span>
                  <button type="button" onClick={() => setBulkResult(null)} className="font-semibold">
                    Dismiss
                  </button>
                </div>
                {bulkResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {bulkResult.errors.map((e) => (
                      <li key={e.row} className="text-[11.5px] text-brick">
                        Row {e.row}: {e.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {!selectedBank ? (
              <div className="py-16 text-center text-text-muted text-sm">
                Select or create a question bank to get started.
              </div>
            ) : (
              <Table
                columns={questionColumns}
                rows={questionsQuery.data ?? []}
                rowKey={(q) => q.id}
                emptyMessage="No questions in this bank yet."
              />
            )}
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h2 className="font-serif text-base font-bold text-text">Test Blueprint</h2>
                <p className="text-[12.5px] text-text-muted mt-0.5">
                  Question count, duration, and pass threshold per category for Test A.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setBlueprintForm({ id: null, category: "quant", question_count: "10", duration_minutes: "20", pass_threshold: "" })
                }
                className="flex items-center gap-1.5 bg-ink hover:bg-ink-dark text-white text-[12.5px] font-semibold rounded-lg px-3 py-2 transition"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Add Blueprint
              </button>
            </div>
            <Table
              columns={blueprintColumns}
              rows={blueprintsQuery.data ?? []}
              rowKey={(b) => b.id}
              emptyMessage="No test blueprint configured yet."
            />
          </div>
        </div>
      </div>

      {bankForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setBankForm(null)}>
          <div className="bg-surface rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-lg font-bold text-text mb-4">
              {bankForm.id ? "Rename Bank" : "New Question Bank"}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                saveBankMutation.mutate(bankForm);
              }}
              className="space-y-4"
            >
              <input
                type="text"
                required
                autoFocus
                value={bankForm.name}
                onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
                placeholder="e.g. Quant Screening Bank"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15"
              />
              <div className="flex justify-end gap-2.5">
                <button type="button" onClick={() => setBankForm(null)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-border text-text hover:bg-bg transition">
                  Cancel
                </button>
                <button type="submit" disabled={saveBankMutation.isPending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-ink hover:bg-ink-dark transition disabled:opacity-60">
                  {saveBankMutation.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {questionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setQuestionForm(null)}>
          <div className="bg-surface rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-lg font-bold text-text mb-4">
              {questionForm.id ? "Edit Question" : "Add Question"}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                saveQuestionMutation.mutate(questionForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Category</label>
                <select
                  value={questionForm.category}
                  onChange={(e) => setQuestionForm({ ...questionForm, category: e.target.value as QuestionCategory })}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Question Text</label>
                <textarea
                  required
                  rows={3}
                  value={questionForm.question_text}
                  onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
                  Options (one per line)
                </label>
                <textarea
                  rows={4}
                  value={questionForm.optionsText}
                  onChange={(e) => setQuestionForm({ ...questionForm, optionsText: e.target.value })}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Correct Answer</label>
                  <input
                    type="text"
                    value={questionForm.correct_answer}
                    onChange={(e) => setQuestionForm({ ...questionForm, correct_answer: e.target.value })}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Difficulty</label>
                  <select
                    value={questionForm.difficulty}
                    onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2.5">
                <button type="button" onClick={() => setQuestionForm(null)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-border text-text hover:bg-bg transition">
                  Cancel
                </button>
                <button type="submit" disabled={saveQuestionMutation.isPending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-ink hover:bg-ink-dark transition disabled:opacity-60">
                  {saveQuestionMutation.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {blueprintForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setBlueprintForm(null)}>
          <div className="bg-surface rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-lg font-bold text-text mb-4">
              {blueprintForm.id ? "Edit Blueprint" : "Add Blueprint"}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                saveBlueprintMutation.mutate(blueprintForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Category</label>
                <select
                  value={blueprintForm.category}
                  onChange={(e) => setBlueprintForm({ ...blueprintForm, category: e.target.value as QuestionCategory })}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Question Count</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={blueprintForm.question_count}
                    onChange={(e) => setBlueprintForm({ ...blueprintForm, question_count: e.target.value })}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Duration (min)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={blueprintForm.duration_minutes}
                    onChange={(e) => setBlueprintForm({ ...blueprintForm, duration_minutes: e.target.value })}
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Pass Threshold (optional)</label>
                <input
                  type="number"
                  value={blueprintForm.pass_threshold}
                  onChange={(e) => setBlueprintForm({ ...blueprintForm, pass_threshold: e.target.value })}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface"
                />
              </div>
              <div className="flex justify-end gap-2.5">
                <button type="button" onClick={() => setBlueprintForm(null)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-border text-text hover:bg-bg transition">
                  Cancel
                </button>
                <button type="submit" disabled={saveBlueprintMutation.isPending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-ink hover:bg-ink-dark transition disabled:opacity-60">
                  {saveBlueprintMutation.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteBankTarget}
        title="Delete this question bank?"
        description={deleteBankTarget ? `This permanently deletes "${deleteBankTarget.name}" and all its questions.` : undefined}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteBankMutation.isPending}
        onCancel={() => setDeleteBankTarget(null)}
        onConfirm={() => deleteBankTarget && deleteBankMutation.mutate(deleteBankTarget.id)}
      />

      <ConfirmDialog
        open={!!deleteQuestionTarget}
        title="Delete this question?"
        confirmLabel="Delete"
        tone="danger"
        loading={deleteQuestionMutation.isPending}
        onCancel={() => setDeleteQuestionTarget(null)}
        onConfirm={() => deleteQuestionTarget && deleteQuestionMutation.mutate(deleteQuestionTarget.id)}
      />

      <ConfirmDialog
        open={!!deleteBlueprintTarget}
        title="Delete this blueprint?"
        confirmLabel="Delete"
        tone="danger"
        loading={deleteBlueprintMutation.isPending}
        onCancel={() => setDeleteBlueprintTarget(null)}
        onConfirm={() => deleteBlueprintTarget && deleteBlueprintMutation.mutate(deleteBlueprintTarget.id)}
      />
    </div>
  );
}
