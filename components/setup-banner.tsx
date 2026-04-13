import Link from "next/link";

import { runtimeFlags } from "@/lib/config";

export function SetupBanner() {
  if (runtimeFlags.hasOpenAI && runtimeFlags.hasDatabase) {
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
      </p>

      <Link className="button button-secondary" href="/settings">
        Open Setup Details
      </Link>
    </section>
  );
}
