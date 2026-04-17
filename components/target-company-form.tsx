"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type TargetCompanyResponse = {
  targetCompany?: {
    id: string;
    status: "ready" | "needs_review";
    detectionNotes: string | null;
  };
  error?: string;
};

export function TargetCompanyForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [companyName, setCompanyName] = useState("");
  const [careersUrl, setCareersUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const response = await fetch("/api/target-companies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyName: companyName.trim(),
        careersUrl: careersUrl.trim() || undefined,
      }),
    });

    const payload = (await response.json()) as TargetCompanyResponse;

    if (!response.ok || !payload.targetCompany) {
      setError(payload.error ?? "The target company could not be saved.");
      return;
    }

    setCompanyName("");
    setCareersUrl("");
    setNotice(
      payload.targetCompany.detectionNotes ??
        (payload.targetCompany.status === "ready"
          ? "Target company added and ready for the sweep."
          : "Target company saved. Add a supported careers URL to enable direct role pulling."),
    );

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="target-company-name">Company name</label>
          <input
            id="target-company-name"
            placeholder="OpenAI"
            required
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="target-company-url">Careers URL</label>
          <input
            id="target-company-url"
            placeholder="jobs.ashbyhq.com/openai"
            value={careersUrl}
            onChange={(event) => setCareersUrl(event.target.value)}
          />
        </div>
      </div>

      <div className="empty-state">
        <h3>Supported direct pull formats</h3>
        <p>
          Hired can detect public Greenhouse, Lever, Ashby, and SmartRecruiters careers URLs.
          If you only enter a company name, Hired will still save it and try to match it to any
          known public board sources already in the app.
        </p>
      </div>

      <div className="form-footer">
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted">
            Saved target companies are folded into the sweep and deduped against the broader market search.
          </span>
          {notice ? <span className="success-text">{notice}</span> : null}
          {error ? <span className="error-text">{error}</span> : null}
        </div>

        <button className="button button-primary" disabled={isPending} type="submit">
          {isPending ? "Saving company…" : "Add Target Company"}
        </button>
      </div>
    </form>
  );
}
