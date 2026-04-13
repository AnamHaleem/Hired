import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { JobIntakeForm } from "@/components/job-intake-form";
import { SectionCard } from "@/components/section-card";

export default function NewJobPage() {
  return (
    <AppShell
      eyebrow="Flow 1"
      title="New Job Intake"
      description="Paste a full job description and Hired will convert it into structured metadata, route the professional lane, and save the intake for human review."
      actions={
        <Link className="button button-secondary" href="/">
          Back to Dashboard
        </Link>
      }
    >
      <div className="grid grid-two">
        <SectionCard
          title="Intake"
          description="The parser is strict by design. It extracts only what the description supports and keeps the original text attached to the record."
        >
          <JobIntakeForm />
        </SectionCard>

        <SectionCard
          title="What happens next"
          description="This follows the runtime flow in the handoff package."
        >
          <div className="stack">
            <div className="empty-state">
              <h3>1. Parse and classify</h3>
              <p>
                We extract company, title, lane, level, must-haves, likely objections, and
                fit-signal keywords into a typed schema.
              </p>
            </div>

            <div className="empty-state">
              <h3>2. Save the intake</h3>
              <p>
                If Railway Postgres is configured through <span className="code">DATABASE_URL</span>,
                we persist there. Otherwise Hired uses a local development store so we can keep
                building and reviewing flows immediately.
              </p>
            </div>

            <div className="empty-state">
              <h3>3. Manual approval gate</h3>
              <p>
                No asset generation happens until a job is explicitly approved. That keeps the
                product aligned with the non-autonomous safety stance from the handoff docs.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
