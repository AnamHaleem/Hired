"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ApproveJobButtonProps = {
  jobId: string;
  status: "new" | "approved" | "discarded";
};

export function ApproveJobButton({
  jobId,
  status,
}: ApproveJobButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status === "approved") {
    return (
      <button className="button button-secondary" disabled type="button">
        Job Approved
      </button>
    );
  }

  async function handleApprove() {
    setError(null);

    const response = await fetch("/api/jobs/approve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobId }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Approval failed.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <button
        className="button button-primary"
        disabled={isPending}
        onClick={handleApprove}
        type="button"
      >
        {isPending ? "Approving…" : "Approve Job"}
      </button>
      {error ? <span className="error-text">{error}</span> : null}
    </div>
  );
}
