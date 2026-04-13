import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { SetupBanner } from "@/components/setup-banner";
import { StatusBadge } from "@/components/status-badge";
import { listJobs } from "@/lib/persistence/job-store";
import { formatDate, getLaneLabel, getStatusTone } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const jobs = await listJobs();
  const approvedCount = jobs.filter((job) => job.status === "approved").length;
  const newCount = jobs.filter((job) => job.status === "new").length;
  const communicationsCount = jobs.filter(
    (job) => job.lane === "senior_communications",
  ).length;
  const marketingCount = jobs.filter(
    (job) => job.lane === "strategic_marketing_partnerships",
  ).length;

  return (
    <AppShell
      eyebrow="Phase 1 Foundation"
      title="Hired"
      description="A retrieval-first job search operating system for intake, lane routing, review, and eventually grounded asset generation. This first cut gives us the real app shell, parser flow, persistence, and manual approval gate."
      actions={
        <>
          <Link className="button button-primary" href="/jobs/new">
            Start a New Intake
          </Link>
          <Link className="button button-secondary" href="/settings">
            Review Setup
          </Link>
        </>
      }
    >
      <SetupBanner />

      <div className="grid grid-four" style={{ marginBottom: 18 }}>
        <SectionCard title="Total Jobs">
          <p className="metric-value">{jobs.length}</p>
          <p className="metric-label">Roles currently tracked across intake and review.</p>
        </SectionCard>

        <SectionCard title="Approved">
          <p className="metric-value">{approvedCount}</p>
          <p className="metric-label">Manually cleared for later asset generation.</p>
        </SectionCard>

        <SectionCard title="Senior Comms">
          <p className="metric-value">{communicationsCount}</p>
          <p className="metric-label">Roles routed into Lane A so far.</p>
        </SectionCard>

        <SectionCard title="Marketing / Partnerships">
          <p className="metric-value">{marketingCount}</p>
          <p className="metric-label">Roles routed into Lane B so far.</p>
        </SectionCard>
      </div>

      <div className="grid grid-two">
        <SectionCard
          title="Recent Intakes"
          description="Every parsed job keeps the raw description, structured analysis, and review status attached to a single record."
        >
          {jobs.length === 0 ? (
            <div className="empty-state">
              <h3>No jobs yet</h3>
              <p>
                Paste the first job description and Hired will parse it, route the lane,
                and save a reviewable record.
              </p>
              <div className="inline-actions">
                <Link className="button button-primary" href="/jobs/new">
                  Add the First Job
                </Link>
              </div>
            </div>
          ) : (
            <ul className="list">
              {jobs.slice(0, 6).map((job) => (
                <li key={job.id} className="list-row">
                  <div>
                    <p className="list-title">{job.title}</p>
                    <div className="meta-line">
                      <span>{job.company}</span>
                      <span>•</span>
                      <span>{getLaneLabel(job.lane)}</span>
                      <span>•</span>
                      <span>{formatDate(job.createdAt)}</span>
                    </div>
                  </div>

                  <div className="badge-row">
                    <StatusBadge tone={getStatusTone(job.status)}>
                      {job.status.replace("_", " ")}
                    </StatusBadge>
                    <Link className="button button-secondary" href={`/jobs/${job.id}`}>
                      Open
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="What This Foundation Covers"
          description="This aligns the handoff docs with a working application baseline."
        >
          <div className="stack">
            <div className="badge-row">
              <StatusBadge tone="accent">Typed job parser schema</StatusBadge>
              <StatusBadge tone="info">Server-side OpenAI integration</StatusBadge>
              <StatusBadge tone="success">Manual approval gate</StatusBadge>
            </div>

            <div className="empty-state">
              <h3>Current phase outcomes</h3>
              <p>
                New job intake, detail pages, environment status, and local-first persistence
                are ready. Retrieval, fit scoring, and asset generation are the next slices.
              </p>
            </div>

            <div className="kpi-strip">
              <span className="code">new jobs this week: {newCount}</span>
              <span className="code">asset generation: pending phase 3</span>
              <span className="code">weekly strategy: pending phase 4</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
