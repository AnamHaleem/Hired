"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  MAX_RESUME_UPLOAD_BYTES,
  MAX_RESUME_UPLOAD_LABEL,
  SUPPORTED_RESUME_ACCEPT,
  SUPPORTED_RESUME_FORMATS_LABEL,
} from "@/lib/resume-formats";

type ResumeResponse = {
  resume?: {
    id: string;
    label: string;
    parsedName: string | null;
    headline: string | null;
    summary: string;
  };
  provider?: "heuristic" | "openai";
  error?: string;
};

type ParsedResumePreview = {
  headline: string | null;
  label: string;
  parsedName: string | null;
  provider: "heuristic" | "openai";
  summary: string;
};

export function ResumeUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedResume, setParsedResume] = useState<ParsedResumePreview | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setParsedResume(null);

    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setError("Choose a resume file first.");
      return;
    }

    if (file.size > MAX_RESUME_UPLOAD_BYTES) {
      setError(`That resume is too large to upload here. Keep it under ${MAX_RESUME_UPLOAD_LABEL}.`);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    if (label.trim()) {
      formData.append("label", label.trim());
    }

    setIsUploading(true);

    try {
      const response = await fetch("/api/resumes", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as ResumeResponse;

      if (!response.ok || !payload.resume || !payload.provider) {
        setError(payload.error ?? "The resume could not be uploaded.");
        return;
      }

      setParsedResume({
        headline: payload.resume.headline,
        label: payload.resume.label,
        parsedName: payload.resume.parsedName,
        provider: payload.provider,
        summary: payload.resume.summary,
      });
      setLabel("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsUploading(false);
    }
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
            accept={SUPPORTED_RESUME_ACCEPT}
            type="file"
          />
          <p className="field-hint">
            {SUPPORTED_RESUME_FORMATS_LABEL} files are supported. PDFs need selectable text, so
            scanned or image-only PDFs may fail. New uploads become the active scoring resume
            automatically. Keep uploads under {MAX_RESUME_UPLOAD_LABEL}.
          </p>
        </div>
      </div>

      <div className="form-footer">
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted">
            Hired parses the uploaded resume into summary, skills, focus areas, and highlights.
          </span>
          {parsedResume ? (
            <>
              <span className="success-text">
                Parsed right away: {parsedResume.label}
                {parsedResume.parsedName ? ` for ${parsedResume.parsedName}` : ""}.
              </span>
              <span className="muted">
                {parsedResume.headline ?? parsedResume.summary}
              </span>
            </>
          ) : null}
          {error ? <span className="error-text">{error}</span> : null}
        </div>

        <button className="button button-primary" disabled={isUploading || isPending} type="submit">
          {isUploading ? "Uploading and parsing…" : isPending ? "Refreshing vault…" : "Upload Resume"}
        </button>
      </div>
    </form>
  );
}
