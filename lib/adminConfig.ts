import { PROGRAM_ID, TENANT_ID } from "./config";

export { PROGRAM_ID, TENANT_ID };

// Decorative only — the Program model (backend) has no cycle/closing-date
// columns, so these are presentational copy rather than API-sourced data.
export const PROGRAM_LABEL = process.env.NEXT_PUBLIC_PROGRAM_LABEL || "MBA · Finance";
export const ADMISSIONS_CYCLE_LABEL =
  process.env.NEXT_PUBLIC_ADMISSIONS_CYCLE_LABEL || "Admissions Cycle 2026";

export const ADMIN_SESSION_COOKIE = "admin_session";
