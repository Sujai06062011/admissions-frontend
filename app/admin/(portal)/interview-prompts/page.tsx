"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPrompt,
  createPromptBank,
  deletePrompt,
  deletePromptBank,
  listPromptBanks,
  listPrompts,
  updatePrompt,
  updatePromptBank,
} from "@/lib/adminApi";
import { PROGRAM_ID, PROGRAM_LABEL } from "@/lib/adminConfig";
import type { PromptBankResponse, PromptResponse, PromptType } from "@/lib/adminTypes";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Table, type TableColumn } from "@/components/admin/Table";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { PlusIcon, TrashIcon } from "@/components/admin/icons";

const PROMPT_TYPES: { value: PromptType; label: string }[] = [
  { value: "question", label: "Question" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
];

function promptTypeLabel(type: string): string {
  return PROMPT_TYPES.find((t) => t.value === type)?.label ?? type;
}

interface PromptFormState {
  id: string | null;
  prompt_type: PromptType;
  media_url: string;
  prompt_text: string;
  category: string;
}

export default function InterviewPromptsPage() {
  const queryClient = useQueryClient();

  const [explicitBankId, setSelectedBankId] = useState<string | null>(null);
  const [bankForm, setBankForm] = useState<{ id: string | null; name: string } | null>(null);
  const [deleteBankTarget, setDeleteBankTarget] = useState<PromptBankResponse | null>(null);
  const [typeFilter, setTypeFilter] = useState<PromptType | "">("");
  const [promptForm, setPromptForm] = useState<PromptFormState | null>(null);
  const [deletePromptTarget, setDeletePromptTarget] = useState<PromptResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const banksQuery = useQuery({
    queryKey: ["prompt-banks", PROGRAM_ID],
    queryFn: () => listPromptBanks(PROGRAM_ID),
  });

  // Falls back to the first bank once loaded, without needing an effect —
  // an explicit user selection (if any) always wins.
  const selectedBankId = explicitBankId ?? banksQuery.data?.[0]?.id ?? null;

  const promptsQuery = useQuery({
    queryKey: ["prompts", selectedBankId, typeFilter],
    queryFn: () => listPrompts(selectedBankId as string, typeFilter || undefined),
    enabled: !!selectedBankId,
  });

  function invalidateBanks() {
    queryClient.invalidateQueries({ queryKey: ["prompt-banks", PROGRAM_ID] });
  }
  function invalidatePrompts() {
    queryClient.invalidateQueries({ queryKey: ["prompts", selectedBankId, typeFilter] });
  }

  const saveBankMutation = useMutation({
    mutationFn: (input: { id: string | null; name: string }) =>
      input.id ? updatePromptBank(input.id, input.name) : createPromptBank(PROGRAM_ID, input.name),
    onSuccess: (bank) => {
      invalidateBanks();
      setBankForm(null);
      setSelectedBankId(bank.id);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteBankMutation = useMutation({
    mutationFn: (bankId: string) => deletePromptBank(bankId),
    onSuccess: () => {
      invalidateBanks();
      setDeleteBankTarget(null);
      setSelectedBankId(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const savePromptMutation = useMutation({
    mutationFn: (input: PromptFormState) => {
      const payload = {
        prompt_type: input.prompt_type,
        media_url: input.media_url || null,
        prompt_text: input.prompt_text || null,
        category: input.category || null,
      };
      return input.id ? updatePrompt(input.id, payload) : createPrompt(selectedBankId as string, payload);
    },
    onSuccess: () => {
      invalidatePrompts();
      setPromptForm(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deletePromptMutation = useMutation({
    mutationFn: (promptId: string) => deletePrompt(promptId),
    onSuccess: () => {
      invalidatePrompts();
      setDeletePromptTarget(null);
    },
    onError: (err: Error) => {
      // The backend returns 409 when a prompt is referenced by a Test B
      // session — surfaced verbatim rather than retried silently.
      setError(err.message);
      setDeletePromptTarget(null);
    },
  });

  const selectedBank = banksQuery.data?.find((b) => b.id === selectedBankId) ?? null;

  const promptColumns: TableColumn<PromptResponse>[] = [
    {
      key: "type",
      header: "Type",
      render: (p) => (
        <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-ink-light/15 text-ink-light">
          {promptTypeLabel(p.prompt_type)}
        </span>
      ),
    },
    {
      key: "content",
      header: "Content",
      className: "max-w-[360px]",
      render: (p) =>
        p.prompt_type === "question" ? (
          <span className="truncate block">{p.prompt_text || "—"}</span>
        ) : (
          <span className="truncate block text-ink-light">{p.media_url || "—"}</span>
        ),
    },
    { key: "category", header: "Category", render: (p) => p.category || "—" },
    {
      key: "action",
      header: "Action",
      className: "text-right",
      headerClassName: "text-right",
      render: (p) => (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() =>
              setPromptForm({
                id: p.id,
                prompt_type: p.prompt_type,
                media_url: p.media_url ?? "",
                prompt_text: p.prompt_text ?? "",
                category: p.category ?? "",
              })
            }
            className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
          >
            Edit
          </button>
          <button type="button" onClick={() => setDeletePromptTarget(p)} className="text-text-muted hover:text-brick">
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <AdminTopbar title="Interview Prompts" subtitle={`${PROGRAM_LABEL} · Test B AI video interview prompts`}>
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
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted px-2 mb-2">Banks</div>
          {banksQuery.isLoading && <div className="text-[12.5px] text-text-muted px-2">Loading…</div>}
          {banksQuery.data?.length === 0 && <div className="text-[12.5px] text-text-muted px-2">No banks yet.</div>}
          <div className="space-y-1">
            {banksQuery.data?.map((bank) => (
              <button
                key={bank.id}
                type="button"
                onClick={() => setSelectedBankId(bank.id)}
                className={`w-full text-left rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                  bank.id === selectedBankId ? "bg-ink text-white" : "text-text hover:bg-bg"
                }`}
              >
                <span className="truncate block">{bank.name}</span>
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

        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 flex-wrap gap-3">
            <div>
              <h2 className="font-serif text-base font-bold text-text">
                {selectedBank ? selectedBank.name : "Select a bank"}
              </h2>
              <p className="text-[12.5px] text-text-muted mt-0.5">{promptsQuery.data?.length ?? 0} prompts</p>
            </div>
            {selectedBank && (
              <div className="flex items-center gap-2.5">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as PromptType | "")}
                  className="border border-border rounded-lg text-[12.5px] px-2.5 py-2 bg-surface"
                >
                  <option value="">All types</option>
                  {PROMPT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setPromptForm({ id: null, prompt_type: "question", media_url: "", prompt_text: "", category: "" })
                  }
                  className="flex items-center gap-1.5 bg-ink hover:bg-ink-dark text-white text-[12.5px] font-semibold rounded-lg px-3 py-2 transition"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Add Prompt
                </button>
              </div>
            )}
          </div>

          {!selectedBank ? (
            <div className="py-16 text-center text-text-muted text-sm">
              Select or create a prompt bank to get started.
            </div>
          ) : (
            <Table
              columns={promptColumns}
              rows={promptsQuery.data ?? []}
              rowKey={(p) => p.id}
              emptyMessage="No prompts in this bank yet."
            />
          )}
        </div>
      </div>

      {bankForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setBankForm(null)}>
          <div className="bg-surface rounded-xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-lg font-bold text-text mb-4">{bankForm.id ? "Rename Bank" : "New Prompt Bank"}</h3>
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
                placeholder="e.g. General MBA Prompts"
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

      {promptForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setPromptForm(null)}>
          <div className="bg-surface rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-lg font-bold text-text mb-4">{promptForm.id ? "Edit Prompt" : "Add Prompt"}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                savePromptMutation.mutate(promptForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Type</label>
                <select
                  value={promptForm.prompt_type}
                  onChange={(e) => setPromptForm({ ...promptForm, prompt_type: e.target.value as PromptType })}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface"
                >
                  {PROMPT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {(promptForm.prompt_type === "image" || promptForm.prompt_type === "video") && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Media URL</label>
                  <input
                    type="url"
                    required
                    value={promptForm.media_url}
                    onChange={(e) => setPromptForm({ ...promptForm, media_url: e.target.value })}
                    placeholder="https://…"
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15"
                  />
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
                  Prompt Text {promptForm.prompt_type !== "question" && "(caption / instructions)"}
                </label>
                <textarea
                  required={promptForm.prompt_type === "question"}
                  rows={3}
                  value={promptForm.prompt_text}
                  onChange={(e) => setPromptForm({ ...promptForm, prompt_text: e.target.value })}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Category (optional)</label>
                <input
                  type="text"
                  value={promptForm.category}
                  onChange={(e) => setPromptForm({ ...promptForm, category: e.target.value })}
                  placeholder="e.g. leadership, teamwork"
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15"
                />
              </div>
              <div className="flex justify-end gap-2.5">
                <button type="button" onClick={() => setPromptForm(null)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-border text-text hover:bg-bg transition">
                  Cancel
                </button>
                <button type="submit" disabled={savePromptMutation.isPending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-ink hover:bg-ink-dark transition disabled:opacity-60">
                  {savePromptMutation.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteBankTarget}
        title="Delete this prompt bank?"
        description={deleteBankTarget ? `This permanently deletes "${deleteBankTarget.name}" and all its prompts.` : undefined}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteBankMutation.isPending}
        onCancel={() => setDeleteBankTarget(null)}
        onConfirm={() => deleteBankTarget && deleteBankMutation.mutate(deleteBankTarget.id)}
      />

      <ConfirmDialog
        open={!!deletePromptTarget}
        title="Delete this prompt?"
        description="If it's currently referenced by a Test B session, the backend will reject this and show an error instead."
        confirmLabel="Delete"
        tone="danger"
        loading={deletePromptMutation.isPending}
        onCancel={() => setDeletePromptTarget(null)}
        onConfirm={() => deletePromptTarget && deletePromptMutation.mutate(deletePromptTarget.id)}
      />
    </div>
  );
}
