"use client";

import { useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import type { LocationSweepResult, SweptRoleMatch } from "@/lib/schemas";
import { formatDate, getLaneLabel, getLevelLabel, getVerdictTone } from "@/lib/utils";

type SweepResponse = Partial<LocationSweepResult> & {
  error?: string;
};

function formatSalary(min: number | null, max: number | null) {
  if (!min && !max) {
    return null;
  }

  const formatter = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

  if (min && max) {
    return `${formatter.format(min)} - ${formatter.format(max)}`;
  }

  return formatter.format(min ?? max ?? 0);
}

export function LocationSweepForm({
  defaultLocation,
  activeResumeLabel,
}: {
  defaultLocation: string;
  activeResumeLabel: string | null;
}) {
  const defaultMinScore = "89";
  const [location, setLocation] = useState(defaultLocation);
  const [minScoreInput, setMinScoreInput] = useState(defaultMinScore);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LocationSweepResult | null>(null);

  function normalizeMinScore(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.min(95, Math.max(60, Math.round(value)));
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return Math.min(95, Math.max(60, Math.round(parsed)));
      }
    }

    return 89;
  }

  function commitMinScore(value: string) {
    const normalized = normalizeMinScore(value);
    const nextValue = String(normalized);
    setMinScoreInput(nextValue);
    return normalized;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    const minScore = commitMinScore(minScoreInput);

    try {
      const response = await fetch("/api/sweep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: location.trim() || undefined,
          minScore,
        }),
      });

      const payload = (await response.json()) as SweepResponse;

      if (!response.ok || !payload.matches || !payload.location || !payload.queries) {
        setError(payload.error ?? "The role sweep could not be completed.");
        setResult(null);
        return;
      }

      setResult(payload as LocationSweepResult);
    } finally {
      setIsLoading(false);
    }
  }

  function renderMatch(match: SweptRoleMatch) {
    const salary = formatSalary(match.salaryMin, match.salaryMax);

    return (
      <article className="entry-card" key={`${match.externalId}-${match.searchQuery}`}>
        <div className="entry-header">
          <div>
            <p className="list-title">{match.title}</p>
            <div className="meta-line">
              <span>{match.company}</span>
              <span>•</span>
              <span>{match.location}</span>
              <span>•</span>
              <span>{getLaneLabel(match.lane)}</span>
              <span>•</span>
              <span>{getLevelLabel(match.level)}</span>
            </div>
          </div>

          <div className="badge-row">
            <StatusBadge tone={getVerdictTone(match.verdict)}>{match.score}% match</StatusBadge>
            <span className="badge badge-info">{match.searchQuery}</span>
          </div>
        </div>

        <p className="entry-copy">{match.bestAngle}</p>

        {salary || match.createdAt ? (
          <div className="kpi-strip">
            {salary ? <span className="code">salary: {salary}</span> : null}
            {match.createdAt ? <span className="code">posted: {formatDate(match.createdAt)}</span> : null}
            <span className="code">source: {match.source}</span>
          </div>
        ) : null}

        {match.matchReasons.length > 0 ? (
          <div className="stack" style={{ gap: 8 }}>
            <p className="list-title">Why it cleared the threshold</p>
            {match.matchReasons.map((reason) => (
              <p className="entry-copy" key={reason}>
                {reason}
              </p>
            ))}
          </div>
        ) : null}

        {match.resumeRecommendations.length > 0 ? (
          <div className="stack" style={{ gap: 8 }}>
            <p className="list-title">Resume changes to strengthen this application</p>
            {match.resumeRecommendations.map((recommendation) => (
              <p className="entry-copy" key={recommendation}>
                {recommendation}
              </p>
            ))}
          </div>
        ) : null}

        {match.topProofPoints.length > 0 ? (
          <div className="stack" style={{ gap: 8 }}>
            <p className="list-title">Proof points already supporting the match</p>
            {match.topProofPoints.map((proofPoint) => (
              <p className="entry-copy" key={proofPoint}>
                {proofPoint}
              </p>
            ))}
          </div>
        ) : null}

        <div className="inline-actions">
          <a
            className="button button-primary"
            href={match.redirectUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open Listing
          </a>
        </div>
      </article>
    );
  }

  return (
    <div className="stack">
      <form className="stack" onSubmit={handleSubmit}>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="sweep-location">Target region</label>
            <input
              id="sweep-location"
              placeholder="Toronto, remote, or GTA"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
            <p className="field-hint">
              Hired uses the saved location from the profile by default, but you can override it for a one-off sweep.
            </p>
          </div>

          <div className="field">
            <label htmlFor="sweep-min-score">Minimum fit score</label>
            <input
              id="sweep-min-score"
              inputMode="numeric"
              max={95}
              min={60}
              step={1}
              type="number"
              value={minScoreInput}
              onBlur={() => {
                if (!minScoreInput.trim()) {
                  setMinScoreInput(defaultMinScore);
                  return;
                }

                commitMinScore(minScoreInput);
              }}
              onChange={(event) => setMinScoreInput(event.target.value)}
            />
            <p className="field-hint">
              Higher numbers keep the sweep tighter. Lowering the threshold should surface more borderline but still relevant matches.
            </p>
          </div>
        </div>

        <div className="form-footer">
          <div className="stack" style={{ gap: 6 }}>
            <span className="muted">
              Active resume: {activeResumeLabel ?? "none selected"}.
            </span>
            {error ? <span className="error-text">{error}</span> : null}
          </div>

          <button className="button button-primary" disabled={isLoading} type="submit">
            {isLoading ? "Sweeping roles…" : "Run Location Sweep"}
          </button>
        </div>
      </form>

      {result ? (
        <div className="stack">
          <div className="empty-state">
            <h3>
              {result.matches.length === 0
                ? "No roles cleared the threshold"
                : `${result.matches.length} strong-fit role${result.matches.length === 1 ? "" : "s"} found`}
            </h3>
            <p>
              Queries used: {result.queries.join(", ")}. Only roles scoring at least {result.minScore}% are shown.
            </p>
          </div>

          {result.matches.map((match) => renderMatch(match))}
        </div>
      ) : null}
    </div>
  );
}
