import Link from "next/link";

import { AchievementForm } from "@/components/achievement-form";
import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/profile-form";
import { ResumeActivateButton } from "@/components/resume-activate-button";
import { ResumeUploadForm } from "@/components/resume-upload-form";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { getLaneLabel } from "@/lib/utils";
import { getProfile, listAchievements } from "@/lib/persistence/profile-store";
import { getActiveResume, listResumes } from "@/lib/persistence/resume-store";

export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const [profile, achievements, resumes, activeResume] = await Promise.all([
    getProfile(),
    listAchievements(),
    listResumes(),
    getActiveResume(),
  ]);

  const communicationsAchievements = achievements.filter(
    (achievement) => achievement.lane === "senior_communications",
  ).length;
  const activeResumeLabel = activeResume?.label ?? "None selected";

  return (
    <AppShell
      eyebrow="Phase 2"
      title="Vault"
      description="Hired scores best when your evidence stack is complete: parsed resume versions for application match, plus atomic achievements for grounded proof points. This screen now manages both."
      actions={
        <>
          <Link className="button button-secondary" href="/">
            Dashboard
          </Link>
          <Link className="button button-primary" href="/jobs/new">
            Score a New Job
          </Link>
        </>
      }
    >
      <div className="grid grid-four" style={{ marginBottom: 18 }}>
        <SectionCard title="Profile">
          <p className="metric-value">{profile ? "1" : "0"}</p>
          <p className="metric-label">
            {profile ? "Single-user profile context is available." : "Optional profile context is still empty."}
          </p>
        </SectionCard>

        <SectionCard title="Resume Versions">
          <p className="metric-value">{resumes.length}</p>
          <p className="metric-label">Uploaded resumes available for match comparison.</p>
        </SectionCard>

        <SectionCard title="Active Resume">
          <p className="metric-value">{activeResume ? "1" : "0"}</p>
          <p className="metric-label">{activeResumeLabel}</p>
        </SectionCard>

        <SectionCard title="Achievements">
          <p className="metric-value">{communicationsAchievements}</p>
          <p className="metric-label">
            Communications-tagged proof points. Total vault records: {achievements.length}.
          </p>
        </SectionCard>
      </div>

      <div className="grid grid-two">
        <SectionCard
          title="Resume Library"
          description="Upload multiple resume versions, let Hired parse them, and switch the active one to compare role match."
        >
          <ResumeUploadForm />
        </SectionCard>

        <SectionCard
          title="Resume Guidance"
          description="How to make resume switching useful when you compare role fit."
        >
          <div className="stack">
            <div className="empty-state">
              <h3>Upload tailored versions</h3>
              <p>
                Store separate communications, partnerships, or generalist versions so Hired can
                score the same job through different positioning lenses.
              </p>
            </div>

            <div className="empty-state">
              <h3>Let the parser read the structure</h3>
              <p>
                Each uploaded file becomes searchable summary, skills, focus areas, and highlight
                bullets that feed directly into match scoring.
              </p>
            </div>

            <div className="empty-state">
              <h3>Switch before you score</h3>
              <p>
                The active resume can be changed here or from the job review screen, so you can
                compare how different versions perform against the same role.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-two" style={{ marginTop: 18 }}>
        <SectionCard
          title="Saved Resumes"
          description="Each resume is parsed and available as a switchable scoring lens."
        >
          {resumes.length === 0 ? (
            <div className="empty-state">
              <h3>No resumes uploaded yet</h3>
              <p>
                Upload the first resume version and Hired will parse it into a reusable match
                profile automatically.
              </p>
            </div>
          ) : (
            <div className="stack">
              {resumes.map((resume) => (
                <article className="entry-card" key={resume.id}>
                  <div className="entry-header">
                    <div>
                      <p className="list-title">{resume.label}</p>
                      <div className="meta-line">
                        <span>{resume.originalFilename}</span>
                        {resume.headline ? <span>• {resume.headline}</span> : null}
                      </div>
                    </div>

                    <div className="badge-row">
                      {resume.isActive ? <StatusBadge tone="success">active</StatusBadge> : null}
                      {resume.lane ? (
                        <StatusBadge tone="accent">{getLaneLabel(resume.lane)}</StatusBadge>
                      ) : null}
                    </div>
                  </div>

                  <p className="entry-copy">{resume.summary}</p>

                  {resume.coreSkills.length > 0 ? (
                    <div>
                      <p className="list-title">Core skills</p>
                      <div className="pills">
                        {resume.coreSkills.map((skill) => (
                          <span className="pill" key={skill}>
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {resume.highlightBullets.length > 0 ? (
                    <div>
                      <p className="list-title">Highlights</p>
                      <div className="stack" style={{ gap: 8 }}>
                        {resume.highlightBullets.slice(0, 3).map((highlight) => (
                          <p className="entry-copy" key={highlight}>
                            {highlight}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="inline-actions">
                    <ResumeActivateButton resumeId={resume.id} isActive={resume.isActive} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Profile Context"
          description="The master summary and target region help the scorer frame opportunity selection without reaching for hidden memory."
        >
          <ProfileForm profile={profile} />
        </SectionCard>
      </div>

      <div className="grid grid-two" style={{ marginTop: 18 }}>
        <SectionCard
          title="Add Achievement"
          description="This is the proof-point pipeline for scoring, generation, and later analytics."
        >
          {profile ? (
            <AchievementForm />
          ) : (
            <div className="empty-state">
              <h3>Create the profile first</h3>
              <p>
                The vault is single-user by design, so Hired needs one saved profile before it
                can attach achievements and retrieve them reliably.
              </p>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Achievements"
          description="Saved proof points stay visible here so you can judge the quality of what the scorer will retrieve."
        >
          {achievements.length === 0 ? (
            <div className="empty-state">
              <h3>No achievements yet</h3>
              <p>
                Add a few high-signal wins and Hired will start surfacing them against new job
                intakes.
              </p>
            </div>
          ) : (
            <div className="stack">
              {achievements.slice(0, 8).map((achievement) => (
                <article className="entry-card" key={achievement.id}>
                  <div className="entry-header">
                    <div>
                      <p className="list-title">
                        {achievement.roleTitle ?? "Untitled achievement"}
                      </p>
                      <div className="meta-line">
                        {achievement.company ? <span>{achievement.company}</span> : null}
                        {achievement.industry ? <span>• {achievement.industry}</span> : null}
                      </div>
                    </div>

                    {achievement.lane ? (
                      <StatusBadge tone="accent">{getLaneLabel(achievement.lane)}</StatusBadge>
                    ) : null}
                  </div>

                  <p className="entry-copy">{achievement.result}</p>

                  {achievement.metrics.length > 0 ? (
                    <div className="pills">
                      {achievement.metrics.map((metric) => (
                        <span className="pill" key={metric}>
                          {metric}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {achievement.tags.length > 0 ? (
                    <div className="badge-row">
                      {achievement.tags.map((tag) => (
                        <StatusBadge key={tag} tone="info">
                          {tag}
                        </StatusBadge>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
