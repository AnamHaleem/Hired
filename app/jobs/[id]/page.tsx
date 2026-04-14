import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ApproveJobButton } from "@/components/approve-job-button";
import { RunFitScoreButton } from "@/components/run-fit-score-button";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { getJobById } from "@/lib/persistence/job-store";
import { getProfile, listAchievements } from "@/lib/persistence/profile-store";
import { getActiveResume, listResumes } from "@/lib/persistence/resume-store";
import {
  formatDate,
  getLaneLabel,
  getLevelLabel,
  getStatusTone,
  getVerdictTone,
} from "@/lib/utils";

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
  const [job, profile, achievements, resumes, activeResume] = await Promise.all([
    getJobById(id),
    getProfile(),
    listAchievements(),
    listResumes(),
    getActiveResume(),
  ]);

  if (!job) {
    notFound();
  }

  const hasScore = job.fitScore !== null;
  const achievementCount = achievements.length;
  const resumeOptions = resumes.map((resume) => ({
    id: resume.id,
    label: resume.label,
    isActive: resume.isActive,
  }));
  const scoredResume = job.analysis.resumeId
    ? resumes.find((resume) => resume.id === job.analysis.resumeId) ?? null
    : null;
  const currentResume = scoredResume ?? activeResume;

  return (
    <AppShell
      eyebrow="Flow 1 Review"
      title={job.title}
      description="This is the decision screen for one role: raw text, parsed metadata, grounded fit scoring, the selected resume lens, retrieved evidence, and the manual approval gate all stay visible together."
      actions={
        <>
          <Link className="button button-secondary" href="/vault">
            Open Vault
          </Link>
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
          <StatusBadge tone={achievementCount > 0 ? "success" : "warning"}>
            vault: {achievementCount} proof point{achievementCount === 1 ? "" : "s"}
          </StatusBadge>
          <StatusBadge tone={resumes.length > 0 ? "accent" : "warning"}>
            resumes: {resumes.length}
          </StatusBadge>
        </div>
      </div>

      <div className="grid grid-two">
        <SectionCard
          title="Parsed Metadata"
          description="Structured output used as the durable record for retrieval, scoring, and later generation."
        >
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

        <SectionCard
          title="Raw Description"
          description="The original source text remains attached to the record for auditing and manual review."
        >
          <div className="prose">{job.description}</div>
        </SectionCard>
      </div>

      <div className="grid grid-two" style={{ marginTop: 18 }}>
        <SectionCard
          title="Fit Score"
          description="Scoring is grounded in the saved profile, the selected resume version, retrieved achievements, and this parsed job record."
          action={
            <RunFitScoreButton
              jobId={job.id}
              hasScore={hasScore}
              resumes={resumeOptions}
              activeResumeId={activeResume?.id ?? null}
            />
          }
        >
          <div className="stack">
            {!hasScore ? (
              <div className="empty-state">
                <h3>Score not run yet</h3>
                <p>
                  Run the scorer to see a verdict, best angle, top proof points, gaps, and hidden
                  objections. It works best when the vault has a profile, at least one uploaded
                  resume, and a few evidence-rich achievements.
                </p>
              </div>
            ) : null}

            <div className="badge-row">
              <StatusBadge tone={hasScore ? "accent" : "neutral"}>
                fit score: {hasScore ? job.fitScore : "not run yet"}
              </StatusBadge>
              {job.analysis.verdict ? (
                <StatusBadge tone={getVerdictTone(job.analysis.verdict)}>
                  {job.analysis.verdict}
                </StatusBadge>
              ) : null}
              <StatusBadge
                tone={job.analysis.scoringProvider === "openai" ? "info" : "warning"}
              >
                scorer: {job.analysis.scoringProvider ?? "not run"}
              </StatusBadge>
              {job.analysis.resumeName ? (
                <StatusBadge tone="success">scored with: {job.analysis.resumeName}</StatusBadge>
              ) : null}
            </div>

            {profile ? (
              <p className="card-description">
                Profile context loaded from <span className="code">{profile.name}</span>.
              </p>
            ) : (
              <p className="card-description">
                No profile is saved yet. The scorer can still run, but the fit case will be less
                grounded.
              </p>
            )}

            {currentResume ? (
              <div className="score-panel">
                <div className="entry-header">
                  <div>
                    <p className="list-title">
                      {scoredResume ? "Resume used for this score" : "Current active resume"}
                    </p>
                    <div className="meta-line">
                      <span>{currentResume.label}</span>
                      {currentResume.headline ? <span>• {currentResume.headline}</span> : null}
                      {currentResume.lane ? (
                        <span>• {getLaneLabel(currentResume.lane)}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="badge-row">
                    {currentResume.isActive ? (
                      <StatusBadge tone="success">active</StatusBadge>
                    ) : null}
                    {job.analysis.resumeName && currentResume.id !== activeResume?.id ? (
                      <StatusBadge tone="neutral">not currently active</StatusBadge>
                    ) : null}
                  </div>
                </div>

                <p className="entry-copy">{currentResume.summary}</p>

                {job.analysis.resumeHighlights.length > 0 ? (
                  <div>
                    <p className="list-title">Resume highlights used in the match</p>
                    <PillList
                      items={job.analysis.resumeHighlights}
                      emptyCopy="Resume-specific highlights will appear here after scoring."
                    />
                  </div>
                ) : currentResume.highlightBullets.length > 0 ? (
                  <div>
                    <p className="list-title">Parsed highlights available</p>
                    <PillList
                      items={currentResume.highlightBullets.slice(0, 3)}
                      emptyCopy="Resume highlights are not available yet."
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="empty-state">
                <h3>No resume uploaded yet</h3>
                <p>
                  Upload one or more resume versions in the vault, then switch between them here
                  to compare how the same role scores against different positioning.
                </p>
                <div className="inline-actions">
                  <Link className="button button-primary" href="/vault">
                    Upload a Resume
                  </Link>
                </div>
              </div>
            )}

            <div className="score-grid">
              <div className="score-panel">
                <p className="list-title">Best angle</p>
                <p className="entry-copy">
                  {job.analysis.bestAngle ??
                    "No angle yet. Run the scorer to generate a role-specific positioning recommendation."}
                </p>
              </div>

              <div className="score-panel">
                <p className="list-title">Top proof points</p>
                <PillList
                  items={job.analysis.topProofPoints}
                  emptyCopy="Retrieved proof points will appear here after scoring."
                />
              </div>
            </div>

            <div className="score-grid">
              <div className="score-panel">
                <p className="list-title">Gaps</p>
                <PillList
                  items={job.analysis.gaps}
                  emptyCopy="No major gaps have been recorded yet."
                />
              </div>

              <div className="score-panel">
                <p className="list-title">Hidden objections</p>
                <PillList
                  items={job.analysis.hiddenObjections}
                  emptyCopy="No hidden objections have been recorded yet."
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Retrieved Proof Points"
          description="These are the achievement records the scorer considered most relevant for this job."
        >
          {job.analysis.retrievedAchievements.length === 0 ? (
            <div className="empty-state">
              <h3>No retrieved proof points yet</h3>
              <p>
                Build the vault, then run the scorer. Hired will rank the most relevant
                achievements and keep the evidence trail attached to this job.
              </p>
              <div className="inline-actions">
                <Link className="button button-primary" href="/vault">
                  Open the Vault
                </Link>
              </div>
            </div>
          ) : (
            <div className="stack">
              {job.analysis.retrievedAchievements.map((achievement) => (
                <article className="entry-card" key={achievement.id}>
                  <div className="entry-header">
                    <div>
                      <p className="list-title">{achievement.summary}</p>
                      <div className="meta-line">
                        {achievement.company ? <span>{achievement.company}</span> : null}
                        {achievement.roleTitle ? <span>• {achievement.roleTitle}</span> : null}
                      </div>
                    </div>
                    <div className="badge-row">
                      {achievement.lane ? (
                        <StatusBadge tone="accent">
                          {getLaneLabel(achievement.lane)}
                        </StatusBadge>
                      ) : null}
                      <StatusBadge tone="info">match {achievement.score}</StatusBadge>
                    </div>
                  </div>

                  <div className="stack" style={{ gap: 10 }}>
                    <div>
                      <p className="list-title">Why it was retrieved</p>
                      <PillList
                        items={achievement.evidence}
                        emptyCopy="This result was retrieved by lexical overlap."
                      />
                    </div>

                    {achievement.metrics.length > 0 ? (
                      <div>
                        <p className="list-title">Metrics</p>
                        <PillList items={achievement.metrics} emptyCopy="No metrics saved." />
                      </div>
                    ) : null}

                    {achievement.tags.length > 0 ? (
                      <div className="badge-row">
                        {achievement.tags.map((tag) => (
                          <StatusBadge key={tag} tone="neutral">
                            {tag}
                          </StatusBadge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-two" style={{ marginTop: 18 }}>
        <SectionCard
          title="Application Safety"
          description="The human-approval model from the handoff package is enforced here."
        >
          <div className="stack">
            <p className="card-description">
              Hired will not auto-send outreach or auto-submit applications. Scoring is advisory,
              and the job only moves from <span className="code">new</span> to{" "}
              <span className="code">approved</span> after an explicit action.
            </p>

            <div className="inline-actions">
              <ApproveJobButton jobId={job.id} status={job.status} />
              <Link className="button button-secondary" href="/">
                Return to Dashboard
              </Link>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Readiness Notes"
          description="What would strengthen the next score or later generation pass."
        >
          <div className="stack">
            <div className="empty-state">
              <h3>{achievementCount > 0 ? "Vault coverage exists" : "Vault is still empty"}</h3>
              <p>
                {achievementCount > 0
                  ? `There are ${achievementCount} saved proof point${achievementCount === 1 ? "" : "s"} available for retrieval. Add more if the returned evidence feels too narrow.`
                  : "Add a few achievements so the scorer can ground its decision in concrete evidence instead of only the parsed job text."}
              </p>
            </div>

            <div className="empty-state">
              <h3>{profile ? "Profile is loaded" : "Profile is missing"}</h3>
              <p>
                {profile
                  ? "The master profile is available for scoring and later generation."
                  : "Create the single-user profile in the vault so Hired can judge jobs against a stable positioning baseline."}
              </p>
            </div>

            <div className="empty-state">
              <h3>
                {resumes.length > 0
                  ? `${resumes.length} resume version${resumes.length === 1 ? "" : "s"} available`
                  : "Resume library is empty"}
              </h3>
              <p>
                {resumes.length > 0
                  ? job.analysis.resumeName
                    ? `This role was last scored with "${job.analysis.resumeName}". Switch the active resume or re-run with another version to compare match quality.`
                    : `The active resume is "${activeResume?.label ?? resumes[0].label}". Re-run the score after switching resumes to compare match positioning.`
                  : "Upload a communications version, a partnerships version, or any tailored variant so the same role can be compared across resume angles."}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
