"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CareerLane } from "@/lib/schemas";

type AchievementResponse = {
  achievement?: {
    id: string;
  };
  error?: string;
};

const laneOptions: Array<{ value: CareerLane; label: string }> = [
  { value: "senior_communications", label: "Senior Communications" },
  {
    value: "strategic_marketing_partnerships",
    label: "Strategic Marketing / Partnerships",
  },
  { value: "hybrid_review", label: "Hybrid Review" },
];

function parseLineList(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function AchievementForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [lane, setLane] = useState<CareerLane>("senior_communications");
  const [industry, setIndustry] = useState("");
  const [situation, setSituation] = useState("");
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  const [metrics, setMetrics] = useState("");
  const [tags, setTags] = useState("");
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/achievements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company: company.trim() || undefined,
        roleTitle: roleTitle.trim() || undefined,
        lane,
        industry: industry.trim() || undefined,
        situation: situation.trim(),
        action: action.trim(),
        result: result.trim(),
        metrics: parseLineList(metrics),
        tags: parseLineList(tags),
        rawText: rawText.trim() || undefined,
      }),
    });

    const payload = (await response.json()) as AchievementResponse;

    if (!response.ok || !payload.achievement) {
      setError(payload.error ?? "The achievement could not be saved.");
      return;
    }

    setCompany("");
    setRoleTitle("");
    setLane("senior_communications");
    setIndustry("");
    setSituation("");
    setAction("");
    setResult("");
    setMetrics("");
    setTags("");
    setRawText("");

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="achievement-company">Company</label>
          <input
            id="achievement-company"
            placeholder="Company or client"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="achievement-role">Role title</label>
          <input
            id="achievement-role"
            placeholder="Director, Communications"
            value={roleTitle}
            onChange={(event) => setRoleTitle(event.target.value)}
          />
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="achievement-lane">Career lane</label>
          <select
            id="achievement-lane"
            value={lane}
            onChange={(event) => setLane(event.target.value as CareerLane)}
          >
            {laneOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="achievement-industry">Industry</label>
          <input
            id="achievement-industry"
            placeholder="Healthcare, public sector, finance"
            value={industry}
            onChange={(event) => setIndustry(event.target.value)}
          />
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="achievement-situation">Situation</label>
          <textarea
            id="achievement-situation"
            placeholder="What challenge, mandate, or moment were you responding to?"
            value={situation}
            onChange={(event) => setSituation(event.target.value)}
            required
            style={{ minHeight: 150 }}
          />
        </div>

        <div className="field">
          <label htmlFor="achievement-action">Action</label>
          <textarea
            id="achievement-action"
            placeholder="What did you actually lead, build, or influence?"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            required
            style={{ minHeight: 150 }}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="achievement-result">Result</label>
        <textarea
          id="achievement-result"
          placeholder="What changed? Include business, reputational, stakeholder, or delivery outcomes."
          value={result}
          onChange={(event) => setResult(event.target.value)}
          required
          style={{ minHeight: 140 }}
        />
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="achievement-metrics">Metrics</label>
          <textarea
            id="achievement-metrics"
            placeholder="One per line: 28% engagement lift"
            value={metrics}
            onChange={(event) => setMetrics(event.target.value)}
            style={{ minHeight: 140 }}
          />
        </div>

        <div className="field">
          <label htmlFor="achievement-tags">Tags</label>
          <textarea
            id="achievement-tags"
            placeholder="One per line: executive communications"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            style={{ minHeight: 140 }}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="achievement-raw-text">Optional raw achievement note</label>
        <textarea
          id="achievement-raw-text"
          placeholder="Paste an original brag sheet bullet or resume note if you want the retrieval layer to search it directly."
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          style={{ minHeight: 140 }}
        />
      </div>

      <div className="form-footer">
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted">
            Achievements are the grounding layer for fit scoring and later generation.
          </span>
          {error ? <span className="error-text">{error}</span> : null}
        </div>

        <button className="button button-primary" disabled={isPending} type="submit">
          {isPending ? "Saving achievement…" : "Add Achievement"}
        </button>
      </div>
    </form>
  );
}
