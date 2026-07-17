"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandHeader } from "@/components/BrandHeader";
import { useCampusSession } from "@/components/campus/CampusSessionProvider";
import { ApiError, candidateLogin, getCandidateStatus } from "@/lib/candidateApi";

export default function CampusLoginPage() {
  const router = useRouter();
  const { setSession } = useCampusSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("Enter both your username and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const login = await candidateLogin(username.trim(), password);
      const status = await getCandidateStatus(login.application_id);
      setSession({ applicationId: login.application_id, programId: status.program_id });
      router.push("/campus/portal");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 401
            ? "Incorrect username or password, or your credentials have expired."
            : err.message
          : "Couldn't sign in. Check your connection and try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[440px] mx-auto px-6 pt-16 pb-20">
      <BrandHeader />

      <h1 className="font-serif text-[24px] font-semibold mb-1.5">Campus Test Portal</h1>
      <p className="text-[13.5px] text-text-muted mb-8 leading-relaxed">
        Sign in with the username and password sent to your email (and WhatsApp, if provided)
        when your application moved to the next stage.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px]"
      >
        <div className="mb-4">
          <label className="block text-[12.5px] font-semibold mb-1.5">Username</label>
          <input
            type="text"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            placeholder="cand-xxxxxx"
            className="w-full px-[13px] py-[11px] border-[1.5px] border-border rounded-[9px] text-sm bg-white focus:outline-none focus:border-ink-light"
          />
        </div>

        <div className="mb-1">
          <label className="block text-[12.5px] font-semibold mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            className="w-full px-[13px] py-[11px] border-[1.5px] border-border rounded-[9px] text-sm bg-white focus:outline-none focus:border-ink-light"
          />
        </div>

        {error && (
          <div className="mt-4 rounded-[11px] border-[1.5px] border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-5 px-[26px] py-3 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink-dark disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {submitting ? "Signing in…" : "Sign in →"}
        </button>
      </form>

      <p className="text-center text-[12px] text-text-muted mt-6">
        Lost your credentials?{" "}
        <span className="font-semibold text-ink-light">Contact the admissions office.</span>
      </p>
    </div>
  );
}
