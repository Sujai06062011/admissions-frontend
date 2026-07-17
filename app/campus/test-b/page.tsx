"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandHeader } from "@/components/BrandHeader";
import { CampusGuard } from "@/components/campus/CampusGuard";
import {
  ApiError,
  getCandidateStatus,
  getPrompt,
  pickRandomPrompt,
  submitTestBRecording,
} from "@/lib/candidateApi";
import { loadTestBPromptCache, saveTestBPromptCache } from "@/lib/candidateSession";
import type { Prompt } from "@/lib/candidateTypes";

const MAX_RECORDING_SECONDS = 120;

function pickSupportedMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(type)) {
      return type;
    }
  }
  return "";
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type RecorderPhase = "idle" | "camera_error" | "previewing" | "recording" | "reviewing";

function PromptDisplay({ prompt }: { prompt: Prompt }) {
  return (
    <div className="bg-surface border border-border rounded-[14px] px-[24px] py-[22px] mb-5">
      <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
        Your prompt
      </div>
      {prompt.prompt_type === "image" && prompt.media_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={prompt.media_url}
          alt="Interview prompt"
          className="w-full rounded-[10px] mb-3 max-h-[320px] object-contain bg-black/5"
        />
      )}
      {prompt.prompt_type === "video" && prompt.media_url && (
        <video src={prompt.media_url} controls className="w-full rounded-[10px] mb-3 max-h-[320px]" />
      )}
      {prompt.prompt_text && (
        <p className="text-[15px] font-medium leading-relaxed">{prompt.prompt_text}</p>
      )}
    </div>
  );
}

function Recorder({
  applicationId,
  promptId,
  onSubmitted,
}: {
  applicationId: string;
  promptId: string;
  onSubmitted: () => void;
}) {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const playbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => stopStream, []);

  async function enableCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPhase("camera_error");
      setCameraError(
        "Your browser doesn't support video recording. Please use a recent version of Chrome, Firefox, Edge, or Safari.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setPhase("previewing");
      requestAnimationFrame(() => {
        if (liveVideoRef.current) liveVideoRef.current.srcObject = stream;
      });
    } catch {
      setPhase("camera_error");
      setCameraError(
        "Couldn't access your camera and microphone. Please grant permission in your browser and try again.",
      );
    }
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mimeType = pickSupportedMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      setRecordedBlob(blob);
      setPhase("reviewing");
      requestAnimationFrame(() => {
        if (playbackVideoRef.current) {
          playbackVideoRef.current.src = URL.createObjectURL(blob);
        }
      });
    };
    recorderRef.current = recorder;
    recorder.start();
    setElapsedSeconds(0);
    setPhase("recording");
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
        return next;
      });
    }, 1000);
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current?.stop();
  }

  function reRecord() {
    setRecordedBlob(null);
    setSubmitError(null);
    setPhase("previewing");
  }

  async function handleSubmit() {
    if (!recordedBlob) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitTestBRecording(applicationId, promptId, recordedBlob, "interview-response.webm");
      stopStream();
      onSubmitted();
    } catch (err) {
      setSubmitting(false);
      setSubmitError(
        err instanceof ApiError ? err.message : "Couldn't submit your recording. Try again.",
      );
    }
  }

  if (phase === "idle") {
    return (
      <div className="text-center py-8">
        <button
          type="button"
          onClick={enableCamera}
          className="px-6 py-3 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink-dark cursor-pointer"
        >
          Enable Camera &amp; Microphone →
        </button>
      </div>
    );
  }

  if (phase === "camera_error") {
    return (
      <div className="rounded-[11px] border-[1.5px] border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
        {cameraError}
        <div className="mt-3">
          <button type="button" onClick={enableCamera} className="underline font-semibold cursor-pointer">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative bg-black rounded-[14px] overflow-hidden mb-4 aspect-video">
        <video
          ref={liveVideoRef}
          autoPlay
          muted
          playsInline
          className={phase === "reviewing" ? "hidden" : "w-full h-full object-cover"}
        />
        <video
          ref={playbackVideoRef}
          controls
          playsInline
          className={phase === "reviewing" ? "w-full h-full object-cover" : "hidden"}
        />
        {phase === "recording" && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 text-white text-[12px] font-semibold px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-brick animate-pulse" />
            {formatSeconds(elapsedSeconds)} / {formatSeconds(MAX_RECORDING_SECONDS)}
          </div>
        )}
      </div>

      {submitError && (
        <div className="mb-4 rounded-[11px] border-[1.5px] border-brick bg-brick-soft px-4 py-3 text-[13px] text-brick font-medium">
          {submitError}
        </div>
      )}

      <div className="flex justify-center gap-3">
        {phase === "previewing" && (
          <button
            type="button"
            onClick={startRecording}
            className="px-6 py-3 rounded-[10px] bg-brick text-white text-sm font-semibold hover:opacity-90 cursor-pointer"
          >
            ● Start Recording
          </button>
        )}
        {phase === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="px-6 py-3 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink-dark cursor-pointer"
          >
            ■ Stop Recording
          </button>
        )}
        {phase === "reviewing" && (
          <>
            <button
              type="button"
              onClick={reRecord}
              disabled={submitting}
              className="px-6 py-3 rounded-[10px] border-[1.5px] border-border text-sm font-semibold hover:border-ink-light disabled:opacity-60 cursor-pointer"
            >
              Re-record
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-3 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink-dark disabled:opacity-60 cursor-pointer"
            >
              {submitting ? "Submitting…" : "Submit Response →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

type ViewState =
  | { kind: "loading" }
  | { kind: "blocked"; message: string }
  | { kind: "fatal"; message: string }
  | { kind: "ready"; prompt: Prompt }
  | { kind: "done" };

function TestBPageContent({ applicationId, programId }: { applicationId: string; programId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    async function resolve() {
      try {
        const status = await getCandidateStatus(applicationId);
        if (!active) return;

        if (!status.campus_session_assigned) {
          setState({
            kind: "blocked",
            message:
              "Your interview slot hasn't been assigned yet. Please check back once your campus schedule is confirmed.",
          });
          return;
        }

        const cachedPromptId = loadTestBPromptCache(applicationId);
        let prompt: Prompt | null;
        if (cachedPromptId) {
          prompt = await getPrompt(cachedPromptId);
        } else {
          prompt = await pickRandomPrompt(programId);
          if (prompt) saveTestBPromptCache(applicationId, prompt.id);
        }

        if (!active) return;
        if (!prompt) {
          setState({
            kind: "fatal",
            message: "The interview hasn't been configured for this program yet. Please check back later.",
          });
          return;
        }
        setState({ kind: "ready", prompt });
      } catch (err) {
        if (!active) return;
        setState({
          kind: "fatal",
          message:
            err instanceof ApiError
              ? err.message
              : "Couldn't load your interview prompt. Check your connection and try again.",
        });
      }
    }

    resolve();
    return () => {
      active = false;
    };
  }, [applicationId, programId]);

  if (state.kind === "loading") {
    return (
      <div className="max-w-[640px] mx-auto px-6 pt-24 text-center text-sm text-text-muted">
        Loading your interview prompt…
      </div>
    );
  }

  if (state.kind === "blocked" || state.kind === "fatal") {
    return (
      <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20">
        <BrandHeader />
        <div className="bg-surface border border-border rounded-[14px] px-[28px] py-[26px] text-center text-[13.5px] text-text-muted leading-relaxed">
          {state.message}
        </div>
      </div>
    );
  }

  if (state.kind === "done") {
    return (
      <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20 text-center">
        <BrandHeader />
        <div className="w-16 h-16 rounded-full bg-forest-soft text-forest flex items-center justify-center text-3xl mx-auto mb-6">
          ✓
        </div>
        <h2 className="font-serif text-xl font-semibold mb-2">Interview response submitted</h2>
        <p className="text-[13.5px] text-text-muted max-w-[380px] mx-auto mb-6">
          Thank you — we&apos;ve received your recording. It&apos;s being reviewed as part of your
          application.
        </p>
        <button
          type="button"
          onClick={() => router.push("/campus/portal")}
          className="px-6 py-3 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink-dark cursor-pointer"
        >
          Back to portal
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[640px] mx-auto px-6 pt-14 pb-20">
      <BrandHeader />
      <h1 className="font-serif text-[22px] font-semibold mb-1.5">Video Interview</h1>
      <p className="text-[13.5px] text-text-muted mb-6 leading-relaxed">
        Read the prompt below, then record your response. You have up to{" "}
        {Math.round(MAX_RECORDING_SECONDS / 60)} minutes.
      </p>
      <PromptDisplay prompt={state.prompt} />
      <Recorder
        applicationId={applicationId}
        promptId={state.prompt.id}
        onSubmitted={() => setState({ kind: "done" })}
      />
    </div>
  );
}

export default function CampusTestBPage() {
  return (
    <CampusGuard>
      {(session) => (
        <TestBPageContent applicationId={session.applicationId} programId={session.programId} />
      )}
    </CampusGuard>
  );
}
