import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { scoreJobFit } from "@/lib/ai/fit-scorer";
import { saveJobScore, getJobById } from "@/lib/persistence/job-store";
import { getProfile, listAchievements } from "@/lib/persistence/profile-store";
import { getActiveResume, getResumeById } from "@/lib/persistence/resume-store";
import { ScoreJobInputSchema, type ScoreJobInput } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as ScoreJobInput;
    const payload = ScoreJobInputSchema.parse(json);
    const job = await getJobById(payload.jobId);

    if (!job) {
      return NextResponse.json(
        {
          error: "Job not found.",
        },
        { status: 404 },
      );
    }

    const [profile, achievements, activeResume] = await Promise.all([
      getProfile(),
      listAchievements(),
      payload.resumeId ? getResumeById(payload.resumeId) : getActiveResume(),
    ]);

    if (payload.resumeId && !activeResume) {
      return NextResponse.json(
        {
          error: "Selected resume not found.",
        },
        { status: 404 },
      );
    }

    const scored = await scoreJobFit({
      job,
      profile,
      resume: activeResume,
      achievements,
    });

    const updatedJob = await saveJobScore(
      job.id,
      scored.result,
      scored.provider,
      scored.model,
      activeResume,
    );

    return NextResponse.json(
      {
        job: updatedJob,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid job scoring payload.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    console.error("Failed to score job", error);

    return NextResponse.json(
      {
        error: "The job could not be scored right now.",
      },
      { status: 500 },
    );
  }
}
