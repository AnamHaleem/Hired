import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { approveJob, getJobById } from "@/lib/persistence/job-store";
import { ApproveJobInputSchema, type ApproveJobInput } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as ApproveJobInput;
    const payload = ApproveJobInputSchema.parse(json);

    const job = await getJobById(payload.jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const updatedJob = await approveJob(payload.jobId);

    return NextResponse.json({ job: updatedJob });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid approval payload.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    console.error("Failed to approve job", error);

    return NextResponse.json(
      { error: "The job could not be approved right now." },
      { status: 500 },
    );
  }
}
