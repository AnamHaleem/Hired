import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { runLocationSweep } from "@/lib/job-sweep/location-sweep";
import { getProfile, listAchievements } from "@/lib/persistence/profile-store";
import { getActiveResume } from "@/lib/persistence/resume-store";
import {
  type LocationSweepInput,
  LocationSweepInputSchema,
} from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as LocationSweepInput;
    const payload = LocationSweepInputSchema.parse(json);
    const profile = await getProfile();
    const resume = await getActiveResume();
    const achievements = await listAchievements();
    const sweep = await runLocationSweep({
      location: payload.location?.trim() || profile?.targetRegion || "",
      minScore: payload.minScore,
      profile,
      resume,
      achievements,
    });

    return NextResponse.json(sweep, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid sweep payload.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 400 },
      );
    }

    console.error("Failed to run location sweep", error);

    return NextResponse.json(
      {
        error: "The location sweep could not be completed right now.",
      },
      { status: 500 },
    );
  }
}
