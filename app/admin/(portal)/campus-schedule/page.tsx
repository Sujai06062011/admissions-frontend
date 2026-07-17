"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCampusSchedule,
  deleteCampusSchedule,
  listCampusSchedules,
  updateCampusSchedule,
} from "@/lib/adminApi";
import { PROGRAM_ID, PROGRAM_LABEL } from "@/lib/adminConfig";
import type { CampusScheduleResponse } from "@/lib/adminTypes";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Table, type TableColumn } from "@/components/admin/Table";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { PlusIcon, TrashIcon } from "@/components/admin/icons";

interface ScheduleFormState {
  id: string | null;
  session_date: string;
  capacity: string;
}

const EMPTY_FORM: ScheduleFormState = { id: null, session_date: "", capacity: "" };

export default function CampusSchedulePage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ScheduleFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CampusScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["campus-schedules", PROGRAM_ID],
    queryFn: () => listCampusSchedules(PROGRAM_ID),
  });

  const schedules = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.session_date.localeCompare(b.session_date)),
    [data],
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["campus-schedules", PROGRAM_ID] });
  }

  const saveMutation = useMutation({
    mutationFn: async (input: ScheduleFormState) => {
      const capacity = Number(input.capacity);
      if (input.id) {
        return updateCampusSchedule(input.id, { session_date: input.session_date, capacity });
      }
      return createCampusSchedule(PROGRAM_ID, { session_date: input.session_date, capacity });
    },
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (scheduleId: string) => deleteCampusSchedule(scheduleId),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const columns: TableColumn<CampusScheduleResponse>[] = [
    {
      key: "date",
      header: "Session Date",
      render: (s) =>
        new Date(`${s.session_date}T00:00:00`).toLocaleDateString(undefined, {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
    },
    { key: "capacity", header: "Capacity", render: (s) => s.capacity },
    { key: "booked", header: "Booked", render: (s) => s.booked_count },
    {
      key: "availability",
      header: "Availability",
      render: (s) => {
        const pct = s.capacity === 0 ? 0 : Math.min(100, Math.round((s.booked_count / s.capacity) * 100));
        const full = s.booked_count >= s.capacity;
        return (
          <div className="flex items-center gap-2 w-40">
            <div className="h-1.5 flex-1 rounded-full bg-border/60 overflow-hidden">
              <div
                className={`h-full rounded-full ${full ? "bg-brick" : "bg-forest"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-[11.5px] font-semibold ${full ? "text-brick" : "text-text-muted"}`}>
              {s.capacity - s.booked_count} left
            </span>
          </div>
        );
      },
    },
    {
      key: "action",
      header: "Action",
      className: "text-right",
      headerClassName: "text-right",
      render: (s) => (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setForm({ id: s.id, session_date: s.session_date, capacity: String(s.capacity) })}
            className="text-[12.5px] font-semibold text-ink-light hover:text-ink"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(s)}
            className="text-text-muted hover:text-brick"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <AdminTopbar
        title="Campus Schedule"
        subtitle={`${PROGRAM_LABEL} · ${schedules.length} session${schedules.length === 1 ? "" : "s"} scheduled`}
      >
        <button
          type="button"
          onClick={() => setForm({ ...EMPTY_FORM })}
          className="flex items-center gap-2 bg-ink hover:bg-ink-dark text-white text-[13px] font-semibold rounded-lg px-4 py-2.5 transition"
        >
          <PlusIcon className="w-4 h-4" />
          Add Session
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

      {isLoading && <div className="text-sm text-text-muted">Loading schedule…</div>}
      {isError && (
        <div className="bg-brick-soft border border-brick/30 text-brick text-sm rounded-xl px-4 py-3">
          Couldn&apos;t load campus schedules.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <Table
            columns={columns}
            rows={schedules}
            rowKey={(s) => s.id}
            emptyMessage="No campus sessions scheduled yet."
          />
        </div>
      )}

      {form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setForm(null)}
        >
          <div
            className="bg-surface rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg font-bold text-text mb-4">
              {form.id ? "Edit Session" : "Add Campus Session"}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                saveMutation.mutate(form);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
                  Session Date
                </label>
                <input
                  type="date"
                  required
                  value={form.session_date}
                  onChange={(e) => setForm({ ...form, session_date: e.target.value })}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
                  Capacity
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-border text-text hover:bg-bg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-ink hover:bg-ink-dark transition disabled:opacity-60"
                >
                  {saveMutation.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this session?"
        description={
          deleteTarget
            ? `This removes the ${new Date(`${deleteTarget.session_date}T00:00:00`).toLocaleDateString()} session${
                deleteTarget.booked_count > 0 ? ` — ${deleteTarget.booked_count} candidates are already booked into it` : ""
              }.`
            : undefined
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            setError(null);
            deleteMutation.mutate(deleteTarget.id);
          }
        }}
      />
    </div>
  );
}
