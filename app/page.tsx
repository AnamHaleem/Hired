import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { SetupBanner } from "@/components/setup-banner";
import { StatusBadge } from "@/components/status-badge";
import { listJobs } from "@/lib/persistence/job-store";
import { listAchievements } from "@/lib/persistence/profile-store";
import { listResumes } from "@/lib/persistence/resume-store";
import { formatDate, getLaneLabel, getStatusTone } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [jobs, achievements, resumes] = await Promise.all([
    listJobs(),
    listAchievements(),
    listResumes(),
  ]);
  const approvedCount = jobs.filter((job) => job.status === "approved").length;
  const newCount = jobs.filter((job) => job.status === "new").length;
  const scoredCount = jobs.filter((job) => job.fitScore !== null).length;

  return (
    <AppShell
      eyebrow="Phase 2 Retrieval"
      title="Hired"
      description="A retrieval-first job search operating system for intake, lane routing, review, grounded scoring, and eventually asset generation. The app now covers job parsing, a multi-resume vault, fit scoring, and the manual approval gate."
      actions={
        <>
          <Link className="button button-secondary" href="/sweep">
            Run a Location Sweep
          </Link>
          <Link className="button button-primary" href="/jobs/new">
            Start a New Intake
          </Link>
          <Link className="button button-secondary" href="/vault">
            Open Vault
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

        <SectionCard title="Scored">
          <p className="metric-value">{scoredCount}</p>
          <p className="metric-label">Jobs with a grounded fit score and evidence trail.</p>
        </SectionCard>

        <SectionCard title="Approved">
          <p className="metric-value">{approvedCount}</p>
          <p className="metric-label">Manually cleared for later asset generation.</p>
        </SectionCard>

        <SectionCard title="Vault Assets">
          <p className="metric-value">{achievements.length + resumes.length}</p>
          <p className="metric-label">
            {achievements.length} proof point{achievements.length === 1 ? "" : "s"} and{" "}
            {resumes.length} resume version{resumes.length === 1 ? "" : "s"} available for match scoring.
          </p>
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
                <Link className="button button-secondary" href="/sweep">
                  Sweep the Market
                </Link>
                <Link className="button button-primary" href="/jobs/new">
                  Add the First Job
                </Link>
                <Link className="button button-secondary" href="/vault">
                  Build the Vault
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
              <StatusBadge tone="warning">Multi-resume upload and switching</StatusBadge>
              <StatusBadge tone="info">Retrieval-first fit scoring</StatusBadge>
              <StatusBadge tone="accent">Multi-source location sweep</StatusBadge>
              <StatusBadge tone="success">Manual approval gate</StatusBadge>
            </div>

            <div className="empty-state">
              <h3>Current phase outcomes</h3>
              <p>
                New job intake, multi-resume vault management, scoring, location sweeps, detail
                pages, environment status, and local-first persistence are ready. Asset
                generation, CRM, and analytics are the next slices.
              </p>
            </div>

            <div className="kpi-strip">
              <span className="code">new jobs this week: {newCount}</span>
              <span className="code">scored jobs: {scoredCount}</span>
              <span className="code">resume versions: {resumes.length}</span>
              <span className="code">vault proof points: {achievements.length}</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
