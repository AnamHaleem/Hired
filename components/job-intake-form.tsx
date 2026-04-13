"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ParseResponse = {
  job?: {
    id: string;
  };
  error?: string;
};

export function JobIntakeForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [source, setSource] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/jobs/parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: source.trim() || undefined,
        description,
      }),
    });

    const payload = (await response.json()) as ParseResponse;

    if (!response.ok || !payload.job) {
      setError(payload.error ?? "The job could not be parsed.");
      return;
    }

    startTransition(() => {
      router.push(`/jobs/${payload.job?.id}`);
      router.refresh();
    });
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="source">Source</label>
          <input
            id="source"
            name="source"
            placeholder="LinkedIn, company site, recruiter email"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          />
          <p className="field-hint">Optional, but useful for auditability and follow-up tracking.</p>
        </div>

        <div className="field">
          <label htmlFor="description-count">Parser expectation</label>
          <div
            id="description-count"
            className="empty-state"
            style={{ padding: 16 }}
            aria-live="polite"
          >
            <strong>{description.length.toLocaleString()} characters</strong>
            <span className="muted">
              Paste the full description for the best structured extraction.
            </span>
          </div>
        </div>
      </div>

      <div className="field">
        <label htmlFor="description">Job description</label>
        <textarea
          id="description"
          name="description"
          placeholder="Paste the full role description here..."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
        <p className="field-hint">
          The API expects a reasonably complete posting. Short snippets will usually classify
          poorly and trigger weaker lane routing.
        </p>
      </div>

      <div className="form-footer">
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted">Manual review stays mandatory before any downstream generation.</span>
          {error ? <span className="error-text">{error}</span> : null}
        </div>

        <button className="button button-primary" disabled={isPending} type="submit">
          {isPending ? "Opening job…" : "Parse and Save Job"}
        </button>
      </div>
    </form>
  );
}
