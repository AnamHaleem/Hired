import Link from "next/link";

import { runtimeFlags } from "@/lib/config";
import { getMarketSourceSummary } from "@/lib/job-search";

export function SetupBanner() {
  const marketSources = getMarketSourceSummary();

  if (runtimeFlags.hasOpenAI && runtimeFlags.hasDatabase && runtimeFlags.hasAdzuna) {
    return null;
  }

  return (
    <section className="banner">
      <p>
        Hired is live in development mode.{" "}
        {!runtimeFlags.hasOpenAI
          ? "OpenAI is missing, so parsing currently falls back to a local heuristic parser. "
          : ""}
        {!runtimeFlags.hasDatabase
          ? "Railway Postgres is not configured yet, so parsed jobs are being stored locally under .data/. "
          : ""}
        {!runtimeFlags.hasAdzuna
          ? `Adzuna credentials are missing, so Hired is currently using ${marketSources.publicSources} public Greenhouse and Lever boards for live internet sweeps. `
          : `Hired is also searching ${marketSources.publicSources} public Greenhouse and Lever boards alongside Adzuna. `}
      </p>

      <Link className="button button-secondary" href="/settings">
        Open Setup Details
      </Link>
    </section>
  );
}
