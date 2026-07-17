"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminApiError, adminLogin } from "@/lib/adminApi";
import { ADMISSIONS_CYCLE_LABEL, PROGRAM_LABEL } from "@/lib/adminConfig";

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 6.75A2.25 2.25 0 0 1 5.25 4.5h13.5A2.25 2.25 0 0 1 21 6.75v10.5A2.25 2.25 0 0 1 18.75 19.5H5.25A2.25 2.25 0 0 1 3 17.25V6.75Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 6.5 8 6 8-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 10.5V6.75a3.75 3.75 0 1 1 7.5 0v3.75m-8.25 0h9a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-6a1.5 1.5 0 0 1 1.5-1.5Z"
      />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (!open) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M6.6 6.6C4.5 8 3 12 3 12s3.75 7.5 9.75 7.5c1.6 0 3-.4 4.2-1.06M17.4 17.4C19.5 16 21 12 21 12s-1.2-2.4-3.3-4.4"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </svg>
  );
}

const BRAND_STATS = [
  { value: "312", label: "Applications" },
  { value: "94.7", label: "Top Score" },
  { value: "5", label: "Pipeline Stages" },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("admin@demo-college.test");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await adminLogin({ email, password });
      router.push(searchParams.get("next") || "/admin/overview");
    } catch (err) {
      setError(
        err instanceof AdminApiError ? err.message : "Something went wrong. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[44%] relative flex-col justify-between overflow-hidden bg-gradient-to-br from-ink-dark via-ink to-ink-dark p-12 text-white">
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-ink-light/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-72 h-72 rounded-full bg-gold/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center text-xl shrink-0">
            🎓
          </div>
          <div>
            <div className="font-serif font-bold text-lg leading-tight">Admit</div>
            <div className="text-[11px] text-white/60">Screening &amp; Interview Portal</div>
          </div>
        </div>

        <div className="relative z-10 max-w-sm">
          <div className="text-[11px] font-semibold tracking-[0.14em] text-gold uppercase mb-4">
            Admissions Intelligence Platform
          </div>
          <h1 className="font-serif text-[34px] leading-[1.15] font-bold mb-4">
            Smart screening.
            <br />
            Better cohorts.
          </h1>
          <p className="text-white/70 text-[15px] leading-relaxed mb-8">
            Automate hard-filter screening, rank by composite score, and manage your entire
            admissions pipeline from one dashboard.
          </p>
          <div className="flex gap-8">
            {BRAND_STATS.map((stat) => (
              <div key={stat.label}>
                <div className="text-gold text-2xl font-bold font-serif">{stat.value}</div>
                <div className="text-[11px] text-white/60 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-[12px] text-white/40">
          Demo College · {PROGRAM_LABEL} · {ADMISSIONS_CYCLE_LABEL}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-bg px-6 py-12">
        <div className="w-full max-w-[380px]">
          <h2 className="font-serif text-[26px] font-bold text-text mb-1">Welcome back</h2>
          <p className="text-text-muted text-sm mb-8">Sign in to access the Admin Portal</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-[11px] font-semibold tracking-wide uppercase text-text-muted mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                  <MailIcon />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@college.edu"
                  className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15 focus:border-ink"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[11px] font-semibold tracking-wide uppercase text-text-muted mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                  <LockIcon />
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-ink/15 focus:border-ink"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-brick-soft border border-brick/30 text-brick text-sm rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-ink hover:bg-ink-dark text-white font-semibold rounded-lg py-3 text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Signing in…" : "Sign in to Portal →"}
            </button>
          </form>

          <p className="text-center text-xs text-text-muted mt-6">
            Demo credentials pre-filled ·{" "}
            <a href="mailto:support@demo-college.test" className="text-gold font-semibold">
              Need help?
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
