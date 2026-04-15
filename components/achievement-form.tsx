"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  AnalysisProvider,
  CareerLane,
  CreateAchievementInput,
} from "@/lib/schemas";

type AchievementResponse = {
  achievement?: {
    id: string;
  };
  error?: string;
};

type ParseAchievementResponse = {
  achievements?: CreateAchievementInput[];
  provider?: AnalysisProvider;
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

function stringifyLineList(value: string[]) {
  return value.join("\n");
}

function getProviderLabel(provider: AnalysisProvider | null) {
  if (provider === "openai") {
    return "OpenAI";
  }

  if (provider === "heuristic") {
    return "the built-in parser";
  }

  return "the parser";
}

export function AchievementForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [lane, setLane] = useState<CareerLane>("senior_communications");
  const [industry, setIndustry] = useState("");
  const [roleContext, setRoleContext] = useState("");
  const [situation, setSituation] = useState("");
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  const [metrics, setMetrics] = useState("");
  const [tags, setTags] = useState("");
  const [rawText, setRawText] = useState("");
  const [parsedAchievements, setParsedAchievements] = useState<CreateAchievementInput[]>([]);
  const [parseProvider, setParseProvider] = useState<AnalysisProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function applyDraft(draft: CreateAchievementInput) {
    if (draft.company) {
      setCompany(draft.company);
    }

    if (draft.roleTitle) {
      setRoleTitle(draft.roleTitle);
    }

    if (draft.lane) {
      setLane(draft.lane);
    }

    if (draft.industry) {
      setIndustry(draft.industry);
    }

    setSituation(draft.situation);
    setAction(draft.action);
    setResult(draft.result);
    setMetrics(stringifyLineList(draft.metrics));
    setTags(stringifyLineList(draft.tags));
    setRawText(draft.rawText ?? "");
  }

  async function saveAchievement(payload: CreateAchievementInput) {
    const response = await fetch("/api/achievements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const parsed = (await response.json()) as AchievementResponse;

    return {
      ok: response.ok && Boolean(parsed.achievement),
      payload: parsed,
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const save = await saveAchievement({
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
    });

    if (!save.ok) {
      setError(save.payload.error ?? "The achievement could not be saved.");
      return;
    }

    setSituation("");
    setAction("");
    setResult("");
    setMetrics("");
    setTags("");
    setRawText("");
    setNotice("Achievement saved to the vault.");

    startTransition(() => {
      router.refresh();
    });
  }

  async function handleParse() {
    setError(null);
    setNotice(null);
    setIsParsing(true);

    try {
      const response = await fetch("/api/achievements/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company: company.trim() || undefined,
          roleTitle: roleTitle.trim() || undefined,
          lane,
          industry: industry.trim() || undefined,
          roleContext: roleContext.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as ParseAchievementResponse;

      if (!response.ok || !payload.achievements || payload.achievements.length === 0) {
        setError(payload.error ?? "Role achievements could not be parsed.");
        return;
      }

      setParsedAchievements(payload.achievements);
      setParseProvider(payload.provider ?? null);
      applyDraft(payload.achievements[0]);
      setNotice(
        `Parsed ${payload.achievements.length} achievement${
          payload.achievements.length === 1 ? "" : "s"
        } from ${getProviderLabel(payload.provider ?? null)}.`,
      );
    } finally {
      setIsParsing(false);
    }
  }

  async function handleSaveParsed(index: number) {
    const draft = parsedAchievements[index];

    if (!draft) {
      return;
    }

    setError(null);
    setNotice(null);

    const save = await saveAchievement(draft);

    if (!save.ok) {
      setError(save.payload.error ?? "The parsed achievement could not be saved.");
      return;
    }

    setParsedAchievements((current) => current.filter((_, currentIndex) => currentIndex !== index));
    applyDraft(draft);
    setNotice("Parsed achievement saved to the vault.");

    startTransition(() => {
      router.refresh();
    });
  }

  async function handleSaveAllParsed() {
    if (parsedAchievements.length === 0) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsImporting(true);

    try {
      for (const draft of parsedAchievements) {
        const save = await saveAchievement(draft);

        if (!save.ok) {
          setError(save.payload.error ?? "One of the parsed achievements could not be saved.");
          return;
        }
      }

      setParsedAchievements([]);
      setSituation("");
      setAction("");
      setResult("");
      setMetrics("");
      setTags("");
      setRawText("");
      setNotice("All parsed achievements were saved to the vault.");

      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsImporting(false);
    }
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

      <div className="field">
        <label htmlFor="achievement-role-context">Role notes or brag sheet excerpt</label>
        <textarea
          id="achievement-role-context"
          placeholder="Paste role bullets, brag sheet notes, or leave this blank and Hired will mine the active resume for this role."
          value={roleContext}
          onChange={(event) => setRoleContext(event.target.value)}
          style={{ minHeight: 140 }}
        />
        <p className="field-hint">
          Parse-first mode uses the active resume plus anything pasted here to extract reusable
          achievement drafts automatically.
        </p>
      </div>

      <div className="inline-actions">
        <button
          className="button button-secondary"
          disabled={isParsing || isPending || isImporting}
          onClick={handleParse}
          type="button"
        >
          {isParsing ? "Parsing role achievements…" : "Parse Achievements from Role"}
        </button>

        {parsedAchievements.length > 0 ? (
          <button
            className="button button-primary"
            disabled={isImporting || isPending || isParsing}
            onClick={handleSaveAllParsed}
            type="button"
          >
            {isImporting ? "Saving parsed achievements…" : "Save All Parsed"}
          </button>
        ) : null}
      </div>

      {parsedAchievements.length > 0 ? (
        <div className="stack">
          <p className="list-title">Parsed role achievements</p>
          {parsedAchievements.map((draft, index) => (
            <article className="entry-card" key={`${draft.result}-${index}`}>
              <div className="entry-header">
                <div>
                  <p className="list-title">
                    {draft.roleTitle ?? roleTitle ?? "Parsed achievement"}
                  </p>
                  <div className="meta-line">
                    {draft.company ? <span>{draft.company}</span> : null}
                    {draft.industry ? <span>• {draft.industry}</span> : null}
                  </div>
                </div>
              </div>

              <p className="entry-copy">
                <strong>Situation:</strong> {draft.situation}
              </p>
              <p className="entry-copy">
                <strong>Action:</strong> {draft.action}
              </p>
              <p className="entry-copy">
                <strong>Result:</strong> {draft.result}
              </p>

              {draft.metrics.length > 0 ? (
                <div className="pills">
                  {draft.metrics.map((metric) => (
                    <span className="pill" key={metric}>
                      {metric}
                    </span>
                  ))}
                </div>
              ) : null}

              {draft.tags.length > 0 ? (
                <div className="badge-row">
                  {draft.tags.map((tag) => (
                    <span className="badge badge-info" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="inline-actions">
                <button
                  className="button button-secondary"
                  onClick={() => applyDraft(draft)}
                  type="button"
                >
                  Use in Form
                </button>
                <button
                  className="button button-primary"
                  onClick={() => handleSaveParsed(index)}
                  type="button"
                >
                  Save Parsed
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

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
          {notice ? <span className="success-text">{notice}</span> : null}
          {error ? <span className="error-text">{error}</span> : null}
        </div>

        <button className="button button-primary" disabled={isPending || isParsing || isImporting} type="submit">
          {isPending ? "Saving achievement…" : "Add Achievement"}
        </button>
      </div>
    </form>
  );
}
