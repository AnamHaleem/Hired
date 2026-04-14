"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ResumeResponse = {
  resume?: {
    id: string;
  };
  error?: string;
};

export function ResumeUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setError("Choose a resume file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    if (label.trim()) {
      formData.append("label", label.trim());
    }

    const response = await fetch("/api/resumes", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as ResumeResponse;

    if (!response.ok || !payload.resume) {
      setError(payload.error ?? "The resume could not be uploaded.");
      return;
    }

    setLabel("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="resume-label">Resume label</label>
          <input
            id="resume-label"
            placeholder="Communications version / partnerships version"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <p className="field-hint">
            Give each version a short label so it is easy to switch and compare later.
          </p>
        </div>

        <div className="field">
          <label htmlFor="resume-file">Resume file</label>
          <input
            ref={fileInputRef}
            id="resume-file"
            accept=".pdf,.docx,.txt,.md,.rtf"
            type="file"
          />
          <p className="field-hint">
            PDF, DOCX, TXT, MD, and RTF are supported. New uploads become the active scoring
            resume automatically.
          </p>
        </div>
      </div>

      <div className="form-footer">
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted">
            Hired parses the uploaded resume into summary, skills, focus areas, and highlights.
          </span>
          {error ? <span className="error-text">{error}</span> : null}
        </div>

        <button className="button button-primary" disabled={isPending} type="submit">
          {isPending ? "Uploading resume…" : "Upload Resume"}
        </button>
      </div>
    </form>
  );
}
