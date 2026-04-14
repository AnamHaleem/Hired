import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getResumeById, setActiveResume } from "@/lib/persistence/resume-store";
import {
  SetActiveResumeInputSchema,
  type SetActiveResumeInput,
} from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as SetActiveResumeInput;
    const payload = SetActiveResumeInputSchema.parse(json);
    const existing = await getResumeById(payload.resumeId);

    if (!existing) {
      return NextResponse.json(
        {
          error: "Resume not found.",
        },
        { status: 404 },
      );
    }

    const resume = await setActiveResume(payload.resumeId);

    return NextResponse.json(
      {
        resume,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid resume selection payload.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    console.error("Failed to activate resume", error);

    return NextResponse.json(
      {
        error: "The selected resume could not be activated right now.",
      },
      { status: 500 },
    );
  }
}
