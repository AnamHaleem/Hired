import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { env, runtimeFlags } from "@/lib/config";
import { getMarketSourceSummary } from "@/lib/job-search";

function EnvStatus({
  label,
  ready,
  value,
}: {
  label: string;
  ready: boolean;
  value: string | undefined;
}) {
  return (
    <div className="list-row">
      <div>
        <p className="list-title">{label}</p>
        <div className="meta-line">
          <span>{ready ? "Configured" : "Missing"}</span>
          {value ? <span>•</span> : null}
          {value ? <span className="code">{value}</span> : null}
        </div>
      </div>
      <StatusBadge tone={ready ? "success" : "warning"}>
        {ready ? "ready" : "needs setup"}
      </StatusBadge>
    </div>
  );
}

export default function SettingsPage() {
  const marketSources = getMarketSourceSummary();

  return (
    <AppShell
      eyebrow="Environment"
      title="Setup and Runtime"
      description="This page makes the current app state explicit so we can keep building while knowing exactly which integrations are live."
      actions={
        <Link className="button button-secondary" href="/">
          Back to Dashboard
        </Link>
      }
    >
      <div className="grid grid-two">
        <SectionCard title="Environment Variables" description="These drive the GitHub, Vercel, and Railway deployment flow for the current implementation.">
          <div className="stack">
            <EnvStatus
              label="DATABASE_URL"
              ready={Boolean(env.DATABASE_URL)}
              value={env.DATABASE_URL ? "configured" : undefined}
            />
            <EnvStatus
              label="OPENAI_API_KEY"
              ready={Boolean(env.OPENAI_API_KEY)}
              value={env.OPENAI_API_KEY ? "configured" : undefined}
            />
            <EnvStatus
              label="OPENAI_PARSER_MODEL"
              ready={Boolean(env.OPENAI_PARSER_MODEL)}
              value={env.OPENAI_PARSER_MODEL}
            />
            <EnvStatus
              label="ADZUNA_APP_ID"
              ready={Boolean(env.ADZUNA_APP_ID)}
              value={env.ADZUNA_APP_ID ? "configured" : undefined}
            />
            <EnvStatus
              label="ADZUNA_APP_KEY"
              ready={Boolean(env.ADZUNA_APP_KEY)}
              value={env.ADZUNA_APP_KEY ? "configured" : undefined}
            />
            <EnvStatus
              label="ADZUNA_COUNTRY"
              ready={Boolean(env.ADZUNA_COUNTRY)}
              value={env.ADZUNA_COUNTRY}
            />
            <EnvStatus
              label="ASHBY_JOB_BOARD_NAMES"
              ready
              value={
                marketSources.countByProvider.ashby > 0
                  ? `${marketSources.countByProvider.ashby} boards`
                  : "none"
              }
            />
            <EnvStatus
              label="GREENHOUSE_BOARD_TOKENS"
              ready
              value={
                marketSources.countByProvider.greenhouse > 0
                  ? `${marketSources.countByProvider.greenhouse} boards`
                  : "none"
              }
            />
            <EnvStatus
              label="LEVER_POSTING_SITES"
              ready
              value={
                marketSources.countByProvider.lever > 0
                  ? `${marketSources.countByProvider.lever} boards`
                  : "none"
              }
            />
            <EnvStatus label="APP_URL" ready value={env.APP_URL} />
          </div>
        </SectionCard>

        <SectionCard title="Runtime Notes" description="How the current build behaves based on what is configured.">
          <div className="stack">
            <div className="empty-state">
              <h3>Deployment topology</h3>
              <p>
                GitHub is the source of truth, Vercel hosts the Next.js app and preview
                deployments, and Railway provides the Postgres database through{" "}
                <span className="code">DATABASE_URL</span>.
              </p>
            </div>

            <div className="empty-state">
              <h3>Parser and scorer</h3>
              <p>
                {runtimeFlags.hasOpenAI
                  ? "OpenAI is enabled. Parser and fit scoring routes will prefer the Responses API with typed schemas."
                  : "OpenAI is not configured yet, so parser and scoring routes fall back to conservative local heuristics for development progress."}
              </p>
            </div>

            <div className="empty-state">
              <h3>Persistence</h3>
              <p>
                {runtimeFlags.hasDatabase
                  ? "Railway Postgres is configured. Jobs, analyses, profiles, and achievement vault records will persist to the PostgreSQL tables managed by the migration scripts in this repo."
                  : "DATABASE_URL is missing, so jobs and the vault are stored in local development files under .data/ for now."}
              </p>
            </div>

            <div className="empty-state">
              <h3>Location sweep</h3>
              <p>
                {runtimeFlags.hasAdzuna
                  ? `Adzuna is configured, and Hired also searches ${marketSources.publicSources} public Ashby, Greenhouse, and Lever company boards through the same scoring pipeline with duplicate cross-checking.`
                  : `Adzuna is missing, but Hired can still search ${marketSources.publicSources} public Ashby, Greenhouse, and Lever company boards as an internet-source fallback.`}
              </p>
            </div>

            <div className="kpi-strip">
              <span className="code">
                parser model: {env.OPENAI_PARSER_MODEL ?? "gpt-5.4-mini"}
              </span>
              <span className="code">
                persistence: {runtimeFlags.hasDatabase ? "railway postgres" : "local file"}
              </span>
              <span className="code">
                market sweep: {runtimeFlags.hasAdzuna ? `adzuna + ${marketSources.publicSources} boards` : `${marketSources.publicSources} public boards`}
              </span>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
