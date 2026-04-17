import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { LocationSweepForm } from "@/components/location-sweep-form";
import { SectionCard } from "@/components/section-card";
import { SetupBanner } from "@/components/setup-banner";
import { getProfile, listAchievements } from "@/lib/persistence/profile-store";
import { getActiveResume } from "@/lib/persistence/resume-store";

export const dynamic = "force-dynamic";

export default async function SweepPage() {
  const [profile, activeResume, achievements] = await Promise.all([
    getProfile(),
    getActiveResume(),
    listAchievements(),
  ]);

  return (
    <AppShell
      eyebrow="Flow 1.5"
      title="Location Sweep"
      description="Search the target region across Adzuna plus public company boards, score discovered roles against the active resume and vault, and only surface opportunities posted within the last 14 days that clear the chosen threshold."
      actions={
        <>
          <Link className="button button-secondary" href="/">
            Back to Dashboard
          </Link>
          <Link className="button button-primary" href="/vault">
            Tune the Vault
          </Link>
        </>
      }
    >
      <SetupBanner />

      <div className="grid grid-two">
        <SectionCard
          title="Role Sweep"
          description="This uses the saved target region, the active resume, and the current achievement vault to look for roles worth reviewing."
        >
          <LocationSweepForm
            activeResumeLabel={activeResume?.label ?? null}
            defaultLocation={profile?.targetRegion ?? ""}
          />
        </SectionCard>

        <SectionCard
          title="How Matching Works"
          description="The sweep uses the same retrieval-first logic as the job detail screen, but applies it to fresh market listings from multiple internet sources."
        >
          <div className="stack">
            <div className="empty-state">
              <h3>1. Search by region and lane</h3>
              <p>
                Hired derives title-family queries from the active resume, then sweeps the target
                region across Adzuna and public Ashby, Greenhouse, and Lever company boards.
              </p>
            </div>

            <div className="empty-state">
              <h3>2. Parse and score each role</h3>
              <p>
                Every listing is normalized into the same parser and fit scorer used elsewhere in
                the app, so the threshold stays consistent.
              </p>
            </div>

            <div className="empty-state">
              <h3>3. Recommend resume upgrades per role</h3>
              <p>
                Each strong-fit result shows what to strengthen in the resume before applying,
                based on the posting language, gaps, and proof points already in the vault.
              </p>
            </div>

            <div className="kpi-strip">
              <span className="code">target region: {profile?.targetRegion ?? "missing"}</span>
              <span className="code">active resume: {activeResume?.label ?? "missing"}</span>
              <span className="code">vault achievements: {achievements.length}</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
