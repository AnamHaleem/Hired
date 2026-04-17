"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type DeleteTargetCompanyResponse = {
  deleted?: boolean;
  error?: string;
};

export function TargetCompanyRemoveButton({
  targetCompanyId,
}: {
  targetCompanyId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);

    const response = await fetch("/api/target-companies", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetCompanyId,
      }),
    });

    const payload = (await response.json()) as DeleteTargetCompanyResponse;

    if (!response.ok || !payload.deleted) {
      setError(payload.error ?? "The target company could not be removed.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      <button
        className="button button-secondary"
        disabled={isPending}
        onClick={handleDelete}
        type="button"
      >
        {isPending ? "Removing…" : "Remove"}
      </button>
      {error ? <span className="error-text">{error}</span> : null}
    </div>
  );
}
