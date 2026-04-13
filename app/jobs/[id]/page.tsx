import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ApproveJobButton } from "@/components/approve-job-button";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { getJobById } from "@/lib/persistence/job-store";
import { formatDate, getLaneLabel, getLevelLabel, getStatusTone } from "@/lib/utils";

export const dynamic = "force-dynamic";

type JobDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function PillList({ items, emptyCopy }: { items: string[]; emptyCopy: string }) {
  if (items.length === 0) {
    return <p className="muted">{emptyCopy}</p>;
  }

  return (
    <div className="pills">
      {items.map((item) => (
        <span className="pill" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;
  const job = await getJobById(id);

  if (!job) {
    notFound();
  }

  return (
    <AppShell
      eyebrow="Flow 1 Review"
      title={job.title}
      description="This view keeps the raw description and the structured parser output side by side so lane routing and approval stay inspectable."
      actions={
        <>
          <Link className="button button-secondary" href="/jobs/new">
            Add Another Job
          </Link>
          <ApproveJobButton jobId={job.id} status={job.status} />
        </>
      }
    >
      <div className="banner">
        <p>
          <strong>{job.company}</strong> • {getLaneLabel(job.lane)} •{" "}
          {getLevelLabel(job.level)} • saved {formatDate(job.createdAt)}
        </p>
        <div className="badge-row">
          <StatusBadge tone={getStatusTone(job.status)}>
            {job.status.replace("_", " ")}
          </StatusBadge>
          <StatusBadge tone="info">
            parser: {job.parserProvider ?? "configured backend"}
          </StatusBadge>
        </div>
      </div>

      <div className="grid grid-two">
        <SectionCard title="Parsed Metadata" description="Structured output used as the durable record for downstream scoring and generation.">
          <div className="stack">
            <div className="badge-row">
              <StatusBadge tone="accent">{getLaneLabel(job.lane)}</StatusBadge>
              <StatusBadge tone="neutral">{getLevelLabel(job.level)}</StatusBadge>
            </div>

            <div>
              <p className="list-title">Must-haves</p>
              <PillList
                items={job.analysis.mustHaves}
                emptyCopy="No clear must-have requirements were confidently extracted."
              />
            </div>

            <div>
              <p className="list-title">Nice-to-haves</p>
              <PillList
                items={job.analysis.niceToHaves}
                emptyCopy="No preferred qualifications were clearly separated yet."
              />
            </div>

            <div>
              <p className="list-title">Pain points</p>
              <PillList
                items={job.analysis.painPoints}
                emptyCopy="Pain points will show here when the parser finds them."
              />
            </div>

            <div>
              <p className="list-title">Likely objections</p>
              <PillList
                items={job.analysis.likelyObjections}
                emptyCopy="No likely objections were flagged for this intake."
              />
            </div>

            <div>
              <p className="list-title">Fit signal keywords</p>
              <PillList
                items={job.analysis.fitSignalKeywords}
                emptyCopy="Keywords will appear here for retrieval and scoring."
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Raw Description" description="The original source text remains attached to the record for auditing and manual review.">
          <div className="prose">{job.description}</div>
        </SectionCard>
      </div>

      <div className="grid grid-two" style={{ marginTop: 18 }}>
        <SectionCard title="Scoring Status" description="Fit scoring is the next implementation slice after this foundation.">
          <div className="stack">
            <div className="empty-state">
              <h3>Phase 2 placeholder</h3>
              <p>
                This panel will show score, verdict, best angle, top proof points, gaps, and
                hidden objections once retrieval and scoring are wired.
              </p>
            </div>

            <div className="badge-row">
              <StatusBadge tone="neutral">
                fit score: {job.fitScore === null ? "not run yet" : job.fitScore}
              </StatusBadge>
              <StatusBadge tone="warning">generation stays locked until approval</StatusBadge>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Application Safety" description="The approval model from the handoff package is already enforced here.">
          <div className="stack">
            <p className="card-description">
              Hired will not auto-send outreach or auto-submit applications. The current
              implementation only moves a job from <span className="code">new</span> to{" "}
              <span className="code">approved</span> after an explicit user action.
            </p>

            <div className="inline-actions">
              <ApproveJobButton jobId={job.id} status={job.status} />
              <Link className="button button-secondary" href="/">
                Return to Dashboard
              </Link>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
