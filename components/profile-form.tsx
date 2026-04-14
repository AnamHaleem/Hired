"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { StoredProfile } from "@/lib/schemas";

type ProfileResponse = {
  profile?: {
    id: string;
  };
  error?: string;
};

type ProfileFormProps = {
  profile: StoredProfile | null;
};

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(profile?.name ?? "");
  const [targetRegion, setTargetRegion] = useState(profile?.targetRegion ?? "");
  const [yearsExperience, setYearsExperience] = useState(
    profile?.yearsExperience?.toString() ?? "",
  );
  const [masterSummary, setMasterSummary] = useState(profile?.masterSummary ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        targetRegion: targetRegion.trim() || undefined,
        yearsExperience: yearsExperience.trim() ? Number(yearsExperience) : null,
        masterSummary: masterSummary.trim(),
      }),
    });

    const payload = (await response.json()) as ProfileResponse;

    if (!response.ok || !payload.profile) {
      setError(payload.error ?? "The profile could not be saved.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="profile-name">Name</label>
          <input
            id="profile-name"
            name="name"
            placeholder="Your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="profile-target-region">Target region</label>
          <input
            id="profile-target-region"
            name="targetRegion"
            placeholder="Toronto / remote / North America"
            value={targetRegion}
            onChange={(event) => setTargetRegion(event.target.value)}
          />
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="profile-years-experience">Years of experience</label>
          <input
            id="profile-years-experience"
            name="yearsExperience"
            inputMode="numeric"
            placeholder="12"
            value={yearsExperience}
            onChange={(event) => setYearsExperience(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="profile-mode">Operating mode</label>
          <div className="empty-state" id="profile-mode" style={{ padding: 16 }}>
            <strong>Single-user expert mode</strong>
            <span className="muted">
              This profile becomes the grounding context for scoring and later asset generation.
            </span>
          </div>
        </div>
      </div>

      <div className="field">
        <label htmlFor="profile-master-summary">Master summary</label>
        <textarea
          id="profile-master-summary"
          name="masterSummary"
          placeholder="Capture the through-line of your career so Hired can score and generate from a stable profile."
          value={masterSummary}
          onChange={(event) => setMasterSummary(event.target.value)}
          required
          style={{ minHeight: 220 }}
        />
        <p className="field-hint">
          This should describe your overall positioning, core sectors, and the kind of outcomes
          you repeatedly drive.
        </p>
      </div>

      <div className="form-footer">
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted">
            The profile is editable and only used server-side for scoring and generation.
          </span>
          {error ? <span className="error-text">{error}</span> : null}
        </div>

        <button className="button button-primary" disabled={isPending} type="submit">
          {isPending ? "Saving profile…" : profile ? "Update Profile" : "Create Profile"}
        </button>
      </div>
    </form>
  );
}
