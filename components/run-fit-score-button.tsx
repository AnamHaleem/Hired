"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ResumeOption = {
  id: string;
  label: string;
  isActive: boolean;
};

type ScoreResponse = {
  job?: {
    id: string;
  };
  error?: string;
};

type RunFitScoreButtonProps = {
  jobId: string;
  hasScore: boolean;
  resumes: ResumeOption[];
  activeResumeId: string | null;
};

export function RunFitScoreButton({
  jobId,
  hasScore,
  resumes,
  activeResumeId,
}: RunFitScoreButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedResumeId, setSelectedResumeId] = useState(
    activeResumeId ?? resumes[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);

    if (selectedResumeId && selectedResumeId !== activeResumeId) {
      const activateResponse = await fetch("/api/resumes/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumeId: selectedResumeId,
        }),
      });

      const activatePayload = (await activateResponse.json()) as { error?: string };

      if (!activateResponse.ok) {
        setError(activatePayload.error ?? "The selected resume could not be activated.");
        return;
      }
    }

    const response = await fetch("/api/jobs/score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId,
        resumeId: selectedResumeId || undefined,
      }),
    });

    const payload = (await response.json()) as ScoreResponse;

    if (!response.ok || !payload.job) {
      setError(payload.error ?? "The fit score could not be generated.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {resumes.length > 0 ? (
        <div className="field">
          <label htmlFor={`resume-score-${jobId}`}>Resume version</label>
          <select
            id={`resume-score-${jobId}`}
            value={selectedResumeId}
            onChange={(event) => setSelectedResumeId(event.target.value)}
          >
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.label}
                {resume.isActive ? " (active)" : ""}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <span className="muted">
          No resume uploaded yet. You can still score from the profile and achievements, but
          switching resume versions will unlock cleaner match comparisons.
        </span>
      )}

      <button className="button button-primary" disabled={isPending} onClick={handleClick} type="button">
        {isPending
          ? "Scoring job…"
          : hasScore
            ? "Re-run Fit Score"
            : "Run Fit Score"}
      </button>
      {error ? <span className="error-text">{error}</span> : null}
    </div>
  );
}
