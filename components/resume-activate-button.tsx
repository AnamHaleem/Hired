"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ResumeActivateButtonProps = {
  resumeId: string;
  isActive: boolean;
};

export function ResumeActivateButton({
  resumeId,
  isActive,
}: ResumeActivateButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);

    const response = await fetch("/api/resumes/activate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resumeId,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "The resume could not be activated.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <button
        className="button button-secondary"
        disabled={isPending || isActive}
        onClick={handleClick}
        type="button"
      >
        {isActive ? "Active Resume" : isPending ? "Switching…" : "Set Active"}
      </button>
      {error ? <span className="error-text">{error}</span> : null}
    </div>
  );
}
